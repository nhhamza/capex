import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin as GoogleLoginBtn } from "@react-oauth/google";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/firebase/client";
import { backendApi } from "@/lib/backendApi";
import { Alert, Box, CircularProgress } from "@mui/material";

interface GoogleLoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function GoogleLogin({ onSuccess, onError }: GoogleLoginProps) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse: any) => {
    setError("");
    setLoading(true);

    try {
      const { credential: idToken } = credentialResponse;

      // Call backend to verify token and get custom token
      const response = await backendApi.post("/api/auth/google", {
        token: idToken,
      });

      const { customToken, alreadyInitialized } = response.data;

      // Sign in with custom token
      await signInWithCustomToken(auth, customToken);

      // Navigate based on initialization status
      if (alreadyInitialized) {
        navigate("/dashboard");
      } else {
        // New user -> onboarding
        navigate("/setup-org");
      }

      onSuccess?.();
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error al iniciar sesión con Google";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    const msg = "Error al iniciar sesión con Google";
    setError(msg);
    onError?.(msg);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "center", my: 1 }}>
        <GoogleLoginBtn
          onSuccess={handleSuccess}
          onError={handleError}
          theme="outline"
          size="large"
          text="signin"
        />
      </Box>
    </>
  );
}
