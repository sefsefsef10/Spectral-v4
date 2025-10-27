/**
 * 🌐 PUBLIC VENDOR MARKETPLACE
 * 
 * Public-facing directory of Spectral-certified AI vendors
 * Demonstrates network effects and two-sided marketplace
 * NO AUTH REQUIRED - fully public for viral reach
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, CheckCircle2, Shield, Star, TrendingUp } from 'lucide-react';

interface VendorListing {
  id: string;
  name: string;
  description: string;
  category: string;
  certificationTier: 'verified' | 'certified' | 'trusted';
  logoUrl?: string;
  website?: string;
  trustPageUrl?: string;
  verificationDate?: string;
  connectedHealthSystems: number;
  certificationBadges: string[];
}

export default function VendorMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Fetch public vendor directory
  const { data: vendors, isLoading } = useQuery<VendorListing[]>({
    queryKey: ['/api/public/vendors', searchQuery, categoryFilter, tierFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (tierFilter !== 'all') params.append('tier', tierFilter);
      
      const res = await fetch(`/api/public/vendors?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch vendors');
      return res.json();
    },
  });

  const categories = [
    'all',
    'Clinical Decision Support',
    'Diagnostic Imaging',
    'Revenue Cycle',
    'Patient Engagement',
    'Population Health',
    'Operational Analytics',
  ];

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'trusted':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            <Star className="w-4 h-4" />
            Trusted
          </div>
        );
      case 'certified':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <Shield className="w-4 h-4" />
            Certified
          </div>
        );
      case 'verified':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Verified
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Spectral Verified AI Marketplace</h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            Discover HIPAA-compliant, clinically-validated AI vendors trusted by leading health systems
          </p>
          <div className="mt-6 flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>{vendors?.length || 0} Certified Vendors</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <span>Network of {vendors?.reduce((sum, v) => sum + v.connectedHealthSystems, 0) || 0} Health Systems</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Tiers</option>
              <option value="trusted">Trusted</option>
              <option value="certified">Certified</option>
              <option value="verified">Verified</option>
            </select>
          </div>
        </div>

        {/* Vendor Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading verified vendors...</p>
          </div>
        ) : vendors && vendors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden">
                {/* Logo */}
                <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
                  {vendor.logoUrl ? (
                    <img src={vendor.logoUrl} alt={vendor.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-4xl font-bold text-gray-300">{vendor.name.charAt(0)}</div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900">{vendor.name}</h3>
                    {getTierBadge(vendor.certificationTier)}
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{vendor.description || 'No description available'}</p>

                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {vendor.category}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>{vendor.connectedHealthSystems} health systems</span>
                    </div>
                  </div>

                  {/* Certification Badges */}
                  {vendor.certificationBadges && vendor.certificationBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {vendor.certificationBadges.slice(0, 3).map((badge, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {vendor.trustPageUrl && (
                      <a
                        href={vendor.trustPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        View Trust Page
                      </a>
                    )}
                    {vendor.website && (
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">No vendors found matching your criteria</p>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-gray-100 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Are you an AI vendor?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Get Spectral Verified and join the leading marketplace for healthcare AI
          </p>
          <a
            href="/vendor-signup"
            className="inline-block px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
          >
            Apply for Certification
          </a>
        </div>
      </div>
    </div>
  );
}
