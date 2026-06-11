import React, { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "../store";
import { Shield, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import logo from "../assets/logo.webp";

export const Login = () => {
  const [, setLocation] = useLocation();
  const { employees, setCurrentUser } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    const user = employees.find(
      (e) =>
        e.username.toLowerCase() === username.trim().toLowerCase() &&
        e.password === password
    );

    if (!user) {
      setError("Invalid username or password.");
      return;
    }

    setCurrentUser(user);
    setLocation(`/${user.role}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm flex flex-col items-center text-center mb-8"
        >
          <img src={logo} alt="Logo" className="mx-auto" />

          <p className="text-muted-foreground mt-1 text-sm">
            E-Material Tracker
          </p>
        </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <p className="text-sm text-muted-foreground mb-5">
            Sign in to your account
          </p>

          <div className="space-y-4">

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-destructive -mt-1">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleLogin}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Sign in
            </button>
          </div>
        </div>


      </motion.div>
    </div>
  );
};