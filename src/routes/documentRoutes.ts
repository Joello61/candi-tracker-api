import { Router } from 'express';
import {
  uploadDocuments,
  getDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
  getDocumentStats,
  getDocumentsByApplication,
  bulkDeleteDocuments,
} from '../controllers/documentController';
import { authenticate } from '../middleware/auth';
import { upload } from '../config/upload';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes des documents
router.post('/upload', upload.array('files', 5), uploadDocuments);
router.get('/', getDocuments);
router.get('/stats', getDocumentStats);
router.get('/application/:applicationId', getDocumentsByApplication);
router.get('/:id', getDocumentById);
router.get('/:id/download', downloadDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);
router.delete('/', bulkDeleteDocuments);

export default router;