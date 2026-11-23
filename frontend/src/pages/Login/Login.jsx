import { useState } from "react";
import "./Login.scss";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }

      // Cookie is managed by the browser.
      // Do not store JWT in localStorage.

      window.location.assign("/dashboard");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to server. Check backend and CORS."
          : err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="webro-login">
      <div className="webro-login__glow" aria-hidden="true" />

      <section className="webro-login__card">
        <div className="webro-login__brand">
          <span className="webro-login__brand-mark">W</span>
          <span>WEBRO</span>
        </div>

        <div className="webro-login__heading">
          <span className="webro-login__eyebrow">
            MANAGEMENT SYSTEM
          </span>

          <h1>Welcome back</h1>

          <p>
            Sign in to access your workspace.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="webro-login__field">
            <label htmlFor="login-email">
              Email address
            </label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="name@webro.studio"
              autoComplete="username"
              maxLength={254}
              required
              disabled={loading}
            />
          </div>

          <div className="webro-login__field">
            <label htmlFor="login-password">
              Password
            </label>

            <div className="webro-login__password">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="webro-login__error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="webro-login__submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="webro-login__footer">
          Secure access · WEBRO Management
        </p>
      </section>
    </main>
  );
}