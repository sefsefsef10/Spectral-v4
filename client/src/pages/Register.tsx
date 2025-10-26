import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["health_system", "vendor"]),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: authRegister } = useAuth();
  const [, setLocation] = useLocation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "health_system",
      organizationName: "",
    },
  });

  const role = watch("role");

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await authRegister(data);
      setLocation("/dashboard");
    } catch (err: any) {
      setFormError("root", {
        message: err.message || "Registration failed",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-xl">Spectral</span>
          </div>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Get started with AI governance for healthcare
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {errors.root && (
              <Alert variant="destructive" data-testid="alert-register-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                {...register("username")}
                placeholder="Choose a username"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                {...register("password")}
                placeholder="Choose a password"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-3">
              <Label>Account Type</Label>
              <RadioGroup
                value={role}
                onValueChange={(value) => setValue("role", value as "health_system" | "vendor")}
                data-testid="radio-role"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="health_system" id="health_system" data-testid="radio-health-system" />
                  <Label htmlFor="health_system" className="font-normal cursor-pointer">
                    <div>
                      <div className="font-medium">Health System</div>
                      <div className="text-sm text-muted-foreground">
                        Hospitals and healthcare organizations
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="vendor" id="vendor" data-testid="radio-vendor" />
                  <Label htmlFor="vendor" className="font-normal cursor-pointer">
                    <div>
                      <div className="font-medium">AI Vendor</div>
                      <div className="text-sm text-muted-foreground">
                        Healthcare AI companies
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationName">
                {role === "health_system" ? "Health System Name" : "Company Name"}
              </Label>
              <Input
                id="organizationName"
                data-testid="input-organization-name"
                {...register("organizationName")}
                placeholder={role === "health_system" ? "Main Hospital System" : "Your Company Inc."}
              />
              {errors.organizationName && (
                <p className="text-sm text-destructive">{errors.organizationName.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-register"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-primary hover:underline"
                data-testid="link-login"
              >
                Sign in
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
