import { z } from 'zod';

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().refine(url => new URL(url).protocol === 'https:', 'Endpoint deve usar HTTPS'),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  user_agent: z.string().optional(),
});
