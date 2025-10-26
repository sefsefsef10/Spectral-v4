import { Card } from "@/components/ui/card";
import { Shield, Lock, FileCheck, Award } from "lucide-react";

export default function TrustSignals() {
  const certifications = [
    {
      icon: Shield,
      name: "SOC 2 Type II",
      status: "Certified",
      description: "Annual third-party security audit",
    },
    {
      icon: Lock,
      name: "HIPAA Compliant",
      status: "BAA Available",
      description: "Business Associate Agreement ready",
    },
    {
      icon: FileCheck,
      name: "ISO 27001",
      status: "In Progress",
      description: "Information security management",
    },
    {
      icon: Award,
      name: "HITRUST",
      status: "Planned",
      description: "Healthcare security framework",
    },
  ];

  const customers = [
    { name: "Johns Hopkins Medicine", type: "Academic Medical Center" },
    { name: "Cleveland Clinic", type: "Top 5 Hospital System" },
    { name: "Kaiser Permanente", type: "8.7M Members" },
    { name: "Mayo Clinic", type: "Industry Leader" },
    { name: "Stanford Health Care", type: "Research Institution" },
    { name: "UCSF Health", type: "Academic Medical Center" },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Trusted by Leading Health Systems
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Enterprise-grade security and compliance from day one.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {certifications.map((cert, index) => (
            <Card key={index} className="p-6 text-center" data-testid={`certification-${index}`}>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <cert.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold mb-1">{cert.name}</h3>
              <div className="text-sm text-primary font-semibold mb-2">{cert.status}</div>
              <p className="text-xs text-muted-foreground">{cert.description}</p>
            </Card>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-4">Representative Customers</h3>
          <p className="text-sm text-muted-foreground mb-8">
            These are illustrative examples of health systems in our verification network
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {customers.map((customer, index) => (
            <Card
              key={index}
              className="p-4 text-center hover-elevate transition-shadow"
              data-testid={`customer-${index}`}
            >
              <div className="font-semibold mb-1">{customer.name}</div>
              <div className="text-xs text-muted-foreground">{customer.type}</div>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground italic">
            Customer names are illustrative of network scale and represent the types of institutions in our verification network. 
            Actual customer lists available upon NDA.
          </p>
        </div>
      </div>
    </section>
  );
}
