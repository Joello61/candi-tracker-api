import { prisma } from '../config/database';
import { DocumentWithApplication, DocumentStats, PaginatedDocuments, DocumentFilters, UploadResult } from '../types/document';
import { UploadDocumentInput, UpdateDocumentInput } from '../utils/documentValidation';
import { getDocumentType, deleteFile } from '../config/upload';
import { DocumentType } from '@prisma/client';
import path from 'path';
import fs from 'fs';

export class DocumentService {
  // Vérifier que l'application appartient à l'utilisateur
  private static async verifyApplicationOwnership(
    userId: string,
    applicationId: string
  ): Promise<boolean> {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });
    return !!application;
  }

  // Vérifier que le document appartient à l'utilisateur
  private static async verifyDocumentOwnership(
    userId: string,
    documentId: string
  ): Promise<boolean> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        application: {
          userId,
        },
      },
    });
    return !!document;
  }

  static async uploadDocuments(
    userId: string,
    files: Express.Multer.File[],
    data: UploadDocumentInput
  ): Promise<UploadResult> {
    // Vérifier que l'application appartient à l'utilisateur
    const ownsApplication = await this.verifyApplicationOwnership(userId, data.applicationId);
    if (!ownsApplication) {
      return {
        success: false,
        errors: ['Candidature non trouvée ou accès refusé']
      };
    }

    const documents: DocumentWithApplication[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        // Déterminer le type de document automatiquement si non fourni
        const documentType = data.type || getDocumentType(file.originalname, file.mimetype) as DocumentType;

        const document = await prisma.document.create({
          data: {
            applicationId: data.applicationId,
            name: data.name || file.originalname,
            type: documentType,
            url: file.path,
            size: file.size,
          },
          include: {
            application: {
              select: {
                id: true,
                company: true,
                position: true,
                status: true,
              },
            },
          },
        });

        documents.push(document);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde du document:', error);
        errors.push(`Erreur pour le fichier ${file.originalname}`);
        
        // Supprimer le fichier si la sauvegarde en base a échoué
        deleteFile(file.path);
      }
    }

    return {
      success: documents.length > 0,
      documents,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  static async getDocuments(
    userId: string,
    filters: DocumentFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedDocuments> {
    const skip = (page - 1) * limit;

    // Construction des filtres WHERE
    const where: any = {
      application: { userId },
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.applicationId) {
      where.applicationId = filters.applicationId;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    // Construction du tri
    const orderBy: any = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Exécution des requêtes
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              company: true,
              position: true,
              status: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  static async getDocumentById(
    userId: string,
    documentId: string
  ): Promise<DocumentWithApplication | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        application: { userId },
      },
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
    });

    return document;
  }

  static async updateDocument(
    userId: string,
    documentId: string,
    data: UpdateDocumentInput
  ): Promise<DocumentWithApplication | null> {
    // Vérifier que le document appartient à l'utilisateur
    const ownsDocument = await this.verifyDocumentOwnership(userId, documentId);
    if (!ownsDocument) {
      return null;
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data,
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
    });

    return document;
  }

  static async deleteDocument(
    userId: string,
    documentId: string
  ): Promise<boolean> {
    try {
      // Récupérer le document pour obtenir le chemin du fichier
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          application: { userId },
        },
      });

      if (!document) {
        return false;
      }

      // Supprimer l'enregistrement en base
      await prisma.document.delete({
        where: { id: documentId },
      });

      // Supprimer le fichier physique
      deleteFile(document.url);

      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression du document:', error);
      return false;
    }
  }

  static async downloadDocument(
    userId: string,
    documentId: string
  ): Promise<{ filePath: string; fileName: string } | null> {
    const document = await this.getDocumentById(userId, documentId);
    
    if (!document || !fs.existsSync(document.url)) {
      return null;
    }

    return {
      filePath: document.url,
      fileName: document.name,
    };
  }

  static async getDocumentStats(userId: string): Promise<DocumentStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Requêtes parallèles pour les statistiques
    const [
      totalDocuments,
      typesCounts,
      monthCount,
      sizeAggregate,
    ] = await Promise.all([
      prisma.document.count({
        where: { application: { userId } },
      }),
      prisma.document.groupBy({
        by: ['type'],
        where: { application: { userId } },
        _count: { type: true },
      }),
      prisma.document.count({
        where: {
          application: { userId },
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.document.aggregate({
        where: { application: { userId } },
        _sum: { size: true },
        _avg: { size: true },
      }),
    ]);

    // Construire l'objet byType
    const byType: Record<DocumentType, number> = {
      CV: 0,
      COVER_LETTER: 0,
      PORTFOLIO: 0,
      CERTIFICATE: 0,
      OTHER: 0,
    };

    typesCounts.forEach(({ type, _count }) => {
      byType[type] = _count.type;
    });

    return {
      total: totalDocuments,
      byType,
      totalSize: sizeAggregate._sum.size || 0,
      averageSize: Math.round(sizeAggregate._avg.size || 0),
      thisMonth: monthCount,
    };
  }

  static async getDocumentsByApplication(
    userId: string,
    applicationId: string
  ): Promise<DocumentWithApplication[]> {
    // Vérifier que l'application appartient à l'utilisateur
    const ownsApplication = await this.verifyApplicationOwnership(userId, applicationId);
    if (!ownsApplication) {
      return [];
    }

    const documents = await prisma.document.findMany({
      where: {
        applicationId,
        application: { userId },
      },
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents;
  }

  static async bulkDelete(
    userId: string,
    documentIds: string[]
  ): Promise<{ deleted: number; errors: string[] }> {
    let deleted = 0;
    const errors: string[] = [];

    for (const documentId of documentIds) {
      const success = await this.deleteDocument(userId, documentId);
      if (success) {
        deleted++;
      } else {
        errors.push(`Impossible de supprimer le document ${documentId}`);
      }
    }

    return { deleted, errors };
  }
}