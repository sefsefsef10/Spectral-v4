/**
 * 🌐 PUBLIC API ROUTES
 * 
 * Public-facing endpoints for Network Effects demonstration
 * NO AUTHENTICATION REQUIRED - designed for viral reach
 */

import { Router } from 'express';
import { logger } from '../logger';
import { db } from '../db';
import { vendors, complianceCertifications, deployments } from '../../shared/schema';
import { eq, sql, ilike, or, and, desc } from 'drizzle-orm';

export const publicRouter = Router();

/**
 * GET /api/public/vendors
 * Public vendor directory - demonstrates network effects
 */
publicRouter.get('/vendors', async (req, res) => {
  try {
    const { search, category, tier } = req.query;

    // Build query conditions
    const conditions = [];
    
    // Only show verified vendors
    conditions.push(eq(vendors.verified, true));
    
    // Search filter
    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(vendors.name, `%${search}%`),
          ilike(vendors.description, `%${search}%`)
        )
      );
    }

    // Category filter
    if (category && category !== 'all' && typeof category === 'string') {
      conditions.push(eq(vendors.category, category));
    }

    // Tier filter
    if (tier && tier !== 'all' && typeof tier === 'string') {
      conditions.push(eq(vendors.certificationTier, tier));
    }

    // Fetch vendors
    const vendorsList = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        description: vendors.description,
        category: vendors.category,
        certificationTier: vendors.certificationTier,
        logoUrl: vendors.logoUrl,
        website: vendors.website,
        trustPageUrl: vendors.trustPageUrl,
        certificationExpiresAt: vendors.certificationExpiresAt,
      })
      .from(vendors)
      .where(and(...conditions))
      .orderBy(desc(vendors.createdAt));

    // Enrich with connection count and certifications
    const enrichedVendors = await Promise.all(
      vendorsList.map(async (vendor) => {
        // Count connected health systems
        const [connectionCount] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(deployments)
          .where(eq(deployments.vendorId, vendor.id));

        // Get certifications
        const certs = await db
          .select({ type: complianceCertifications.type })
          .from(complianceCertifications)
          .where(
            and(
              eq(complianceCertifications.vendorId, vendor.id),
              eq(complianceCertifications.status, 'verified')
            )
          )
          .limit(5);

        return {
          ...vendor,
          connectedHealthSystems: connectionCount?.count || 0,
          certificationBadges: certs.map((c) => c.type),
          verificationDate: vendor.certificationExpiresAt
            ? new Date(vendor.certificationExpiresAt.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        };
      })
    );

    logger.info({ count: enrichedVendors.length }, 'Public vendor directory accessed');

    res.json(enrichedVendors);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch public vendor directory');
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

/**
 * GET /api/public/vendors/:id
 * Public vendor detail page
 */
publicRouter.get('/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.verified, true)))
      .limit(1);

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Count connected health systems
    const [connectionCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(deployments)
      .where(eq(deployments.vendorId, id));

    // Get certifications
    const certs = await db
      .select()
      .from(complianceCertifications)
      .where(
        and(
          eq(complianceCertifications.vendorId, id),
          eq(complianceCertifications.status, 'verified')
        )
      );

    const enrichedVendor = {
      ...vendor,
      connectedHealthSystems: connectionCount?.count || 0,
      certifications: certs,
    };

    logger.info({ vendorId: id }, 'Public vendor detail accessed');

    res.json(enrichedVendor);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch vendor details');
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

/**
 * GET /api/public/network-stats
 * Public network effects metrics
 */
publicRouter.get('/network-stats', async (req, res) => {
  try {
    // Total verified vendors
    const [vendorCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(vendors)
      .where(eq(vendors.verified, true));

    // Total health system connections
    const [connectionCount] = await db
      .select({ count: sql<number>`cast(count(distinct health_system_id) as int)` })
      .from(deployments);

    // Total certifications issued
    const [certCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(complianceCertifications)
      .where(eq(complianceCertifications.status, 'verified'));

    // Tier distribution
    const tierDist = await db
      .select({
        tier: vendors.certificationTier,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(vendors)
      .where(eq(vendors.verified, true))
      .groupBy(vendors.certificationTier);

    const stats = {
      totalVendors: vendorCount?.count || 0,
      totalHealthSystems: connectionCount?.count || 0,
      totalCertifications: certCount?.count || 0,
      tierDistribution: tierDist.reduce(
        (acc, { tier, count }) => ({
          ...acc,
          [tier || 'unknown']: count,
        }),
        {}
      ),
    };

    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch network stats');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
