import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InventoryModel } from '../models/Inventory';

export const inventoryRouter = Router();

const upsertSchema = z.object({
  ingredientName:    z.string().min(1).trim().toLowerCase(),
  stockLevel:        z.number().int().min(0),
  criticalThreshold: z.number().int().min(0).default(5),
  unit:              z.string().trim().default('portions'),
});

/** GET /api/inventory — list all tracked ingredients */
inventoryRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await InventoryModel.find().sort({ ingredientName: 1 }).lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/inventory — upsert a single ingredient stock record */
inventoryRouter.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = upsertSchema.parse(req.body);
    const item = await InventoryModel.findOneAndUpdate(
      { ingredientName: validated.ingredientName },
      validated,
      { new: true, upsert: true }
    ).lean();
    res.status(200).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
    } else {
      next(err);
    }
  }
});

/** POST /api/inventory/seed — seed default stock levels for standard menu items */
inventoryRouter.post('/seed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaults = [
      { ingredientName: 'smash burger',      stockLevel: 50, criticalThreshold: 8,  unit: 'patties'   },
      { ingredientName: 'truffle fries',     stockLevel: 40, criticalThreshold: 6,  unit: 'portions'  },
      { ingredientName: 'caesar salad',      stockLevel: 30, criticalThreshold: 5,  unit: 'portions'  },
      { ingredientName: 'grilled chicken',   stockLevel: 35, criticalThreshold: 5,  unit: 'portions'  },
      { ingredientName: 'margherita pizza',  stockLevel: 20, criticalThreshold: 4,  unit: 'portions'  },
      { ingredientName: 'onion rings',       stockLevel: 60, criticalThreshold: 10, unit: 'portions'  },
      { ingredientName: 'mushroom soup',     stockLevel: 25, criticalThreshold: 4,  unit: 'portions'  },
      { ingredientName: 'garlic bread',      stockLevel: 45, criticalThreshold: 8,  unit: 'portions'  },
      { ingredientName: 'mozzarella sticks', stockLevel: 30, criticalThreshold: 5,  unit: 'portions'  },
      { ingredientName: 'chocolate lava',    stockLevel: 20, criticalThreshold: 3,  unit: 'portions'  },
      { ingredientName: 'vanilla sundae',    stockLevel: 24, criticalThreshold: 4,  unit: 'portions'  },
      { ingredientName: 'lemonade',          stockLevel: 100,criticalThreshold: 15, unit: 'glasses'   },
      { ingredientName: 'cold brew',         stockLevel: 50, criticalThreshold: 8,  unit: 'cups'      },
      { ingredientName: 'mango lassi',       stockLevel: 40, criticalThreshold: 6,  unit: 'glasses'   },
    ];

    const ops = defaults.map(d => ({
      updateOne: {
        filter: { ingredientName: d.ingredientName },
        update: { $setOnInsert: d },
        upsert: true,
      }
    }));

    const result = await InventoryModel.bulkWrite(ops);
    res.json({
      message: 'Inventory seeded successfully',
      upserted: result.upsertedCount,
      matched: result.matchedCount,
    });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/inventory/:name — remove a tracked ingredient */
inventoryRouter.delete('/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = (req.params['name'] as string).toLowerCase();
    await InventoryModel.deleteOne({ ingredientName: name });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
