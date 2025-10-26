import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Award, ExternalLink, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@shared/schema";

export default function VendorDirectoryPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors/public"],
  });

  // Get unique categories from vendors
  const categories = Array.from(new Set(vendors.map(v => v.category).filter(Boolean)));

  // Filter vendors
  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = 
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || vendor.category === categoryFilter;
    const matchesTier = tierFilter === "all" || vendor.certificationTier === tierFilter;

    return matchesSearch && matchesCategory && matchesTier;
  });

  const getTierBadgeColor = (tier: string | null) => {
    switch (tier) {
      case "Trusted":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "Certified":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Verified":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
              <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-sm">S</span>
              </div>
              <span className="font-semibold text-xl">Spectral</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setLocation("/")} data-testid="button-back-home">
                Back to Home
              </Button>
              <Button onClick={() => setLocation("/pricing")} data-testid="button-pricing">
                Get Verified
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Award className="w-4 h-4" />
            Spectral Verified Directory
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Trusted AI Vendors for Healthcare
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            {vendors.length} AI vendors verified for HIPAA compliance, security, and clinical safety
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b bg-background sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors by name, category, or description..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-vendors"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category || ""}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger data-testid="select-tier-filter">
                <SelectValue placeholder="All Certification Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Trusted">Trusted</SelectItem>
                <SelectItem value="Certified">Certified</SelectItem>
                <SelectItem value="Verified">Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </p>
            {(searchQuery || categoryFilter !== "all" || tierFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setTierFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Vendor Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {isLoading ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Loading vendors...</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-20">
              <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-2">No vendors found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVendors.map((vendor) => (
                <Card key={vendor.id} className="hover-elevate" data-testid={`card-vendor-${vendor.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">{vendor.name}</CardTitle>
                        {vendor.category && (
                          <p className="text-sm text-muted-foreground">{vendor.category}</p>
                        )}
                      </div>
                      {vendor.certificationTier && (
                        <Badge className={getTierBadgeColor(vendor.certificationTier)} data-testid={`badge-tier-${vendor.id}`}>
                          <Award className="w-3 h-3 mr-1" />
                          {vendor.certificationTier}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-base line-clamp-3">
                      {vendor.description || "AI vendor verified by Spectral"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {vendor.website && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => window.open(vendor.website!, "_blank")}
                          data-testid={`button-visit-${vendor.id}`}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visit Website
                        </Button>
                      )}
                      {vendor.trustPageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(vendor.trustPageUrl!, "_blank")}
                          data-testid={`button-trust-page-${vendor.id}`}
                        >
                          Trust Page
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Is your AI vendor not listed?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Get Spectral Verified and appear in this directory where health systems search for trusted AI vendors
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/products/beacon")} data-testid="button-learn-certification">
              Learn About Certification
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/pricing")} data-testid="button-view-pricing">
              View Pricing
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
