import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileText, Download, Filter } from "lucide-react";
import type { ComplianceTemplate } from "@shared/schema";

export default function TemplateLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ComplianceTemplate | null>(null);

  // Build query params for filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    if (selectedFramework && selectedFramework !== "all") params.append("framework", selectedFramework);
    if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
    if (selectedTags.length > 0) params.append("tags", selectedTags.join(","));
    return params.toString();
  };

  const queryParams = buildQueryParams();
  const { data: templates, isLoading } = useQuery<ComplianceTemplate[]>({
    queryKey: ["/api/templates", {
      search: searchQuery || undefined,
      framework: (selectedFramework && selectedFramework !== "all") ? selectedFramework : undefined,
      category: (selectedCategory && selectedCategory !== "all") ? selectedCategory : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    }],
    queryFn: async () => {
      const res = await fetch(`/api/templates${queryParams ? `?${queryParams}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleDownload = (template: ComplianceTemplate) => {
    // Create a blob from the markdown content
    const blob = new Blob([template.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const frameworks = ["HIPAA", "NIST_AI_RMF", "FDA_SaMD", "ISO_27001", "ISO_42001", "General"];
  const categories = ["Risk Assessment", "Data Privacy", "Model Validation", "Audit", "Policy", "Checklist"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Compliance Template Library</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-page-description">
          Pre-built compliance templates and frameworks for healthcare AI governance
        </p>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            {/* Framework Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Framework</label>
              <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                <SelectTrigger data-testid="select-framework">
                  <SelectValue placeholder="All Frameworks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworks.map((fw) => (
                    <SelectItem key={fw} value={fw}>
                      {fw.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Tag Filters */}
          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Tag Filters</label>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => handleTagClick(tag)}
                    data-testid={`badge-active-tag-${tag}`}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Clear Filters */}
          {(searchQuery || selectedFramework || selectedCategory || selectedTags.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedFramework("");
                setSelectedCategory("");
                setSelectedTags([]);
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && templates && (
        <p className="text-sm text-muted-foreground" data-testid="text-results-count">
          Found {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setSelectedTemplate(template)}
              data-testid={`card-template-${template.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.framework.replace(/_/g, " ")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{template.category}</Badge>
                  <Badge variant="outline">{template.fileType}</Badge>
                </div>
                {template.tags && template.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {template.tags.slice(0, 3).map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs cursor-pointer hover-elevate"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagClick(tag);
                        }}
                        data-testid={`badge-tag-${tag}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium" data-testid="text-no-results">No templates found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your filters or search query
            </p>
          </CardContent>
        </Card>
      )}

      {/* Template Detail Dialog */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-template-detail">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {selectedTemplate.name}
              </DialogTitle>
              <DialogDescription>
                {selectedTemplate.framework.replace(/_/g, " ")} • {selectedTemplate.category}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              </div>

              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedTemplate.tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate"
                        onClick={() => {
                          handleTagClick(tag);
                          setSelectedTemplate(null);
                        }}
                        data-testid={`badge-modal-tag-${tag}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Content Preview</h3>
                <div className="bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {selectedTemplate.content.slice(0, 1000)}
                    {selectedTemplate.content.length > 1000 && "..."}
                  </pre>
                </div>
              </div>

              {selectedTemplate.downloadable && (
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => handleDownload(selectedTemplate)}
                    data-testid="button-download-template"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
