import { Router, Request, Response, NextFunction } from 'express';
import { OrderModel } from '../models/Order';
import { getPrepSummary } from '../services/aiSummarizer';

export const analyticsRouter = Router();

analyticsRouter.get('/prep-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getPrepSummary();
    res.type('text/plain').send(summary);
  } catch (error) {
    next(error);
  }
});

// SLA threshold in milliseconds (12 minutes)
const SLA_THRESHOLD_MS = 12 * 60 * 1000;

analyticsRouter.get('/sla-breaches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slaData = await OrderModel.aggregate([
      {
        $match: {
          status:    'served',
          createdAt: { $exists: true },
          readyAt:   { $exists: true },
        }
      },
      {
        $addFields: {
          totalPrepMs: { $subtract: ['$readyAt', '$createdAt'] }
        }
      },
      {
        $facet: {
          byHour: [
            {
              $group: {
                _id: { $hour: '$createdAt' },
                totalOrders:  { $sum: 1 },
                breachCount:  {
                  $sum: {
                    $cond: [{ $gt: ['$totalPrepMs', SLA_THRESHOLD_MS] }, 1, 0]
                  }
                },
                avgPrepMs:    { $avg: '$totalPrepMs' },
                maxPrepMs:    { $max: '$totalPrepMs' },
              }
            },
            {
              $project: {
                hour:             '$_id',
                totalOrders:      1,
                breachCount:      1,
                breachRatePct:    {
                  $round: [
                    { $multiply: [{ $divide: ['$breachCount', '$totalOrders'] }, 100] },
                    1
                  ]
                },
                avgPrepMinutes:   { $round: [{ $divide: ['$avgPrepMs', 60000] }, 1] },
                maxPrepMinutes:   { $round: [{ $divide: ['$maxPrepMs', 60000] }, 1] },
                _id: 0
              }
            },
            { $sort: { hour: 1 } }
          ],
          summary: [
            {
              $group: {
                _id:           null,
                totalOrders:   { $sum: 1 },
                totalBreaches: {
                  $sum: {
                    $cond: [{ $gt: ['$totalPrepMs', SLA_THRESHOLD_MS] }, 1, 0]
                  }
                },
                avgPrepMs:     { $avg: '$totalPrepMs' },
              }
            },
            {
              $project: {
                _id:              0,
                totalOrders:      1,
                totalBreaches:    1,
                overallBreachPct: {
                  $round: [
                    { $multiply: [{ $divide: ['$totalBreaches', '$totalOrders'] }, 100] },
                    1
                  ]
                },
                avgPrepMinutes:   { $round: [{ $divide: ['$avgPrepMs', 60000] }, 1] },
              }
            }
          ]
        }
      }
    ]);

    const result = slaData[0] ?? { byHour: [], summary: [] };
    res.json({
      slaThresholdMinutes: 12,
      summary: result.summary[0] ?? { totalOrders: 0, totalBreaches: 0, overallBreachPct: 0, avgPrepMinutes: 0 },
      byHour: result.byHour,
    });
  } catch (error) {
    next(error);
  }
});


analyticsRouter.get('/predictive-insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const currentDayOfWeek = now.getDay() + 1; // MongoDB $dayOfWeek is 1-7 (Sun-Sat)
    const currentHour = now.getHours();

    const [historicalBaselines, currentQueue] = await Promise.all([
      OrderModel.aggregate([
        { $match: { status: 'served', readyAt: { $exists: true }, cookingStartedAt: { $exists: true } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              dayOfWeek: { $dayOfWeek: '$createdAt' },
              hourOfDay: { $hour: '$createdAt' },
              itemName: '$items.name'
            },
            avgPrepDurationMs: { $avg: { $subtract: ['$readyAt', '$cookingStartedAt'] } },
            orderVolume: { $sum: 1 }
          }
        },
        { $match: { '_id.dayOfWeek': currentDayOfWeek, '_id.hourOfDay': currentHour } },
        {
          $project: {
            itemName: '$_id.itemName',
            avgPrepDurationMinutes: { $divide: ['$avgPrepDurationMs', 60000] },
            orderVolume: 1,
            _id: 0
          }
        }
      ]),
      OrderModel.aggregate([
        { $match: { status: { $in: ['received', 'cooking'] } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            currentActiveCount: { $sum: 1 }
          }
        }
      ])
    ]);

    const alerts: string[] = [];
    const baselineMap = new Map(historicalBaselines.map(b => [b.itemName, b]));

    currentQueue.forEach(item => {
      const baseline = baselineMap.get(item._id);
      if (baseline) {
        // High risk if current active items exceed 1.5x of the historical average hourly volume
        if (item.currentActiveCount > baseline.orderVolume * 1.5) {
          alerts.push(`Warning: High risk of delay on item [${item._id}] due to volume surges (Active: ${item.currentActiveCount}, Historical Avg: ${baseline.orderVolume.toFixed(1)}).`);
        }
      }
    });

    if (alerts.length === 0) {
      alerts.push('Status Optimal: No significant bottlenecks detected based on historical data.');
    }

    res.json({
      dayOfWeek: currentDayOfWeek,
      hourOfDay: currentHour,
      baselines: historicalBaselines,
      currentActive: currentQueue,
      alerts
    });
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [prepDurationData, ordersByHourData] = await Promise.all([
      // 1. Average preparation duration grouped by item name
      OrderModel.aggregate([
        { $match: { cookingStartedAt: { $exists: true }, readyAt: { $exists: true } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            avgPrepDurationMs: { $avg: { $subtract: ['$readyAt', '$cookingStartedAt'] } },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            itemName: '$_id',
            avgPrepDurationMinutes: { $divide: ['$avgPrepDurationMs', 60000] },
            count: 1,
            _id: 0
          }
        },
        { $sort: { avgPrepDurationMinutes: -1 } }
      ]),

      // 2. Total orders generated, grouped by hour of the day
      OrderModel.aggregate([
        {
          $group: {
            _id: { $hour: '$createdAt' },
            totalOrders: { $sum: 1 }
          }
        },
        {
          $project: {
            hour: '$_id',
            totalOrders: 1,
            _id: 0
          }
        },
        { $sort: { hour: 1 } }
      ])
    ]);

    res.json({
      averagePreparationTimePerItem: prepDurationData,
      ordersByHour: ordersByHourData
    });
  } catch (error) {
    next(error);
  }
});
