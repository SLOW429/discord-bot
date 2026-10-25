import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  DISCORD_TEST_GUILD_ID: z.string().optional(),
  ENABLE_MESSAGE_CONTENT_INTENT: z.enum(['true', 'false']).default('false'),
});

export const env = schema.parse(process.env);
