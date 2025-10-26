import { complianceControlsCatalog } from './translation-engine/compliance-controls-catalog';
import { eventTypesTaxonomy } from './translation-engine/event-types-taxonomy';

export async function initializeComplianceCatalog(): Promise<void> {
  try {
    console.log('🔒 Initializing Spectral Compliance Catalog...');
    console.log('━'.repeat(60));

    await complianceControlsCatalog.initializeCatalog();
    
    const controlsCount = complianceControlsCatalog.getControlsCount();
    console.log('\n📋 Compliance Controls Summary:');
    console.log(`   Total Controls: ${controlsCount.total}`);
    Object.entries(controlsCount.byFramework).forEach(([framework, count]) => {
      console.log(`   - ${framework}: ${count} controls`);
    });

    await eventTypesTaxonomy.initializeTaxonomy();
    
    const eventTypesCount = eventTypesTaxonomy.getEventTypesCount();
    console.log('\n🔔 Event Types Summary:');
    console.log(`   Total Event Types: ${eventTypesCount.total}`);
    Object.entries(eventTypesCount.byCategory).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} types`);
    });

    console.log('\n━'.repeat(60));
    console.log('✅ Compliance catalog initialization complete!');
    console.log(`   Moat Expansion: 15 → ${controlsCount.total} controls (${Math.round((controlsCount.total / 15 - 1) * 100)}% increase)`);
    console.log(`   Event Coverage: 5 → ${eventTypesCount.total} types (${Math.round((eventTypesCount.total / 5 - 1) * 100)}% increase)`);
    console.log('━'.repeat(60));
  } catch (error) {
    console.error('❌ Failed to initialize compliance catalog:', error);
    throw error;
  }
}
