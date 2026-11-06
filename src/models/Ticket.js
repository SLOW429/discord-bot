const { Schema, model } = require('mongoose');

const ticketSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  channelId: String,
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  closing: { type: Boolean, default: false },
  transcriptArchivedAt: Date,
  closedBy: String,
  closedAt: Date
}, { timestamps: true });

ticketSchema.index(
  { guildId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);
ticketSchema.index(
  { channelId: 1 },
  { unique: true, partialFilterExpression: { channelId: { $type: 'string' } } }
);

module.exports = model('Ticket', ticketSchema);
