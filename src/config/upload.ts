import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mimeTypes from 'mime-types';
import { prisma } from './database';

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer un sous-dossier par utilisateur
    const userId = (req as any).userId;
    const userDir = path.join(uploadsDir, userId || 'temp');
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom unique avec l'extension originale
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// Fonction de filtrage des fichiers
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Types de fichiers autorisés
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Formats acceptés: PDF, DOC, DOCX, TXT, JPG, PNG, WEBP'));
  }
};

// Configuration de multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // Maximum 5 fichiers à la fois
  }
});

// Fonction utilitaire pour obtenir le type de document basé sur le nom/mime
export const getDocumentType = (filename: string, mimetype: string): string => {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.includes('cv') || lowerName.includes('resume')) {
    return 'CV';
  }
  if (lowerName.includes('cover') || lowerName.includes('lettre') || lowerName.includes('motivation')) {
    return 'COVER_LETTER';
  }
  if (lowerName.includes('portfolio')) {
    return 'PORTFOLIO';
  }
  if (lowerName.includes('certificate') || lowerName.includes('certificat') || lowerName.includes('diploma')) {
    return 'CERTIFICATE';
  }
  
  return 'OTHER';
};

// Fonction pour nettoyer les anciens fichiers
export const cleanupOldFiles = async (userId: string, maxAgeInDays: number = 30): Promise<void> => {
  const userDir = path.join(uploadsDir, userId);
  
  if (!fs.existsSync(userDir)) {
    return;
  }

  const files = fs.readdirSync(userDir);
  const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000; // en millisecondes

  for (const file of files) {
    const filePath = path.join(userDir, file);
    const stats = fs.statSync(filePath);
    
    if (Date.now() - stats.mtime.getTime() > maxAge) {
      // Vérifier que le fichier n'est pas référencé en base
      const document = await prisma.document.findFirst({
        where: {
          url: filePath,
          application: { userId }
        }
      });

      if (!document) {
        fs.unlinkSync(filePath);
      }
    }
  }
};

// Fonction pour supprimer un fichier
export const deleteFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
    return false;
  }
};