import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  documentType: { type: String, required: true },
  summary: { type: String },
  confidenceScore: { type: String },
  processingTime: { type: String },
  date: { type: String },
  due_date: { type: String },
  risks: { type: Array, default: [] },
  clauses: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});

export const Document = mongoose.model('Document', documentSchema);
