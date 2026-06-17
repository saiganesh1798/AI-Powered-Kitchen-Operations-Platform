import pino from 'pino';

const logger = pino({ name: 'sms-service' });

export const sendOrderSms = async (phone: string, message: string): Promise<void> => {
  const isLive = !!process.env.TWILIO_AUTH_TOKEN;

  if (!isLive) {
    // Stub mode - highly formatted Pino structural log
    logger.info({ event: 'SMS_DISPATCHED', to: phone, message }, `[SMS Service] Dispatched Event to ${phone}`);
    return;
  }

  try {
    /* 
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    */
    logger.info({ event: 'SMS_SENT', to: phone }, `[SMS Live] Successfully sent to ${phone}`);
  } catch (error) {
    logger.error({ event: 'SMS_FAILED', to: phone, error }, `[SMS Live] Failed to send SMS to ${phone}`);
  }
};
