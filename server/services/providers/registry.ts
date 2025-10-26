/**
 * Provider Registry
 * 
 * Factory for creating provider adapters based on type
 */

import type { IProviderAdapter, ProviderType } from './types';
import { EpicAdapter } from './epic-adapter';

export class ProviderRegistry {
  private static adapters: Map<ProviderType, IProviderAdapter> = new Map();
  
  /**
   * Register all available adapters
   */
  static initialize() {
    this.register(new EpicAdapter());
    // Future: Add Cerner, Athenahealth, LangSmith, etc.
  }
  
  /**
   * Register a provider adapter
   */
  static register(adapter: IProviderAdapter) {
    this.adapters.set(adapter.providerType, adapter);
  }
  
  /**
   * Get adapter for provider type
   */
  static getAdapter(providerType: ProviderType): IProviderAdapter {
    const adapter = this.adapters.get(providerType);
    if (!adapter) {
      throw new Error(`No adapter registered for provider type: ${providerType}`);
    }
    return adapter;
  }
  
  /**
   * Get all registered adapters
   */
  static getAllAdapters(): IProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Check if provider type is supported
   */
  static isSupported(providerType: string): boolean {
    return this.adapters.has(providerType as ProviderType);
  }
}

// Initialize registry on import
ProviderRegistry.initialize();
