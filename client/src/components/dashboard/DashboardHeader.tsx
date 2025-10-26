import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Settings } from "lucide-react";

export default function DashboardHeader() {
  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">S</span>
          </div>
          <span className="font-bold text-xl">Spectral</span>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" data-testid="button-notifications">
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback>JS</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-medium" data-testid="text-user-name">Jane Smith</div>
              <div className="text-xs text-muted-foreground">CISO</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
