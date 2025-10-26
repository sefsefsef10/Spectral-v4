import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.username, data.password);
      setLocation("/dashboard");
    } catch (err: any) {
      setFormError("root", {
        message: err.message || "Invalid credentials",
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
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {errors.root && (
              <Alert variant="destructive" data-testid="alert-login-error">
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
                placeholder="Enter your username"
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
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-login"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-primary hover:underline"
                data-testid="link-register"
              >
                Sign up
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
