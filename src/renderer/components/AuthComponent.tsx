import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from './ui/badge';
import { User, LogIn, LogOut, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { AuthStatus, AuthError } from '../../preload';
import { SKIP_AUTH_USER_EMAIL, SKIP_AUTH_USER_FIRST_NAME, SKIP_AUTH_USER_ID, SKIP_AUTH_USER_LAST_NAME } from '../../lib/constants/auth.constants';

interface AuthComponentProps {
  isSkippingAuth: boolean;
  onAuthChange: (authStatus: AuthStatus) => void;
  setIsSkippingAuth: (isSkippingAuth: boolean) => void;
}

const AuthComponent: React.FC<AuthComponentProps> = ({
  isSkippingAuth,
  onAuthChange,
  setIsSkippingAuth,
}) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthDetails, setShowAuthDetails] = useState(false);

  const handleAuthSuccess = (
    _event: Electron.CrossProcessExports.IpcRendererEvent | null,
    data: AuthStatus
  ) => {
    onAuthChange(data);
    setAuthStatus(data);
    setError(null);
    setIsLoading(false);
  };

  // Load initial auth status
  useEffect(() => {
    loadAuthStatus();

    // Listen for auth events
    // const handleAuthSuccess = (event: any, data: AuthStatus) => {
    //   setAuthStatus(data);
    //   setError(null);
    //   setIsLoading(false);
    //   onAuthChange(data);
    // };

    const handleAuthError = (event: any, errorData: AuthError) => {
      console.error('Auth error:', errorData);
      setError(errorData.message);
      setIsLoading(false);
    };

    const handleAuthLogout = () => {
      setAuthStatus({ authenticated: false });
      setError(null);
      onAuthChange({ authenticated: false });
    };

    window.electronAPI.onAuthSuccess(handleAuthSuccess);
    window.electronAPI.onAuthError(handleAuthError);
    window.electronAPI.onAuthLogout(handleAuthLogout);

    return () => {
      window.electronAPI.removeAllListeners('auth-success');
      window.electronAPI.removeAllListeners('auth-error');
      window.electronAPI.removeAllListeners('auth-logout');
    };
  }, [onAuthChange]);

  const loadAuthStatus = async () => {
    try {
      if (isSkippingAuth) {
        setAuthStatus({ authenticated: true, user: { id: SKIP_AUTH_USER_ID, email: SKIP_AUTH_USER_EMAIL, firstName: SKIP_AUTH_USER_FIRST_NAME, lastName: SKIP_AUTH_USER_LAST_NAME} });
        onAuthChange({ authenticated: true, user: { id: SKIP_AUTH_USER_ID, email: SKIP_AUTH_USER_EMAIL, firstName: SKIP_AUTH_USER_FIRST_NAME, lastName: SKIP_AUTH_USER_LAST_NAME } });
        return;
      }

      const status = await window.electronAPI.getAuthStatus();
      setAuthStatus(status);
      onAuthChange(status);
    } catch (error) {
      console.error('Error loading auth status:', error);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electronAPI.startOAuth();
      // The actual authentication will be handled by the OAuth flow
      // and the auth-success event will be triggered
    } catch (error) {
      console.error('Error starting OAuth:', error);
      setError('Failed to start authentication');
      setIsLoading(false);
    }
  };

  const handleSkipAuth = () => {
    setIsSkippingAuth(true);
    setError(null);

    handleAuthSuccess(
      null,
      {
        authenticated: true,
        user: {
          id: SKIP_AUTH_USER_ID,
          email: SKIP_AUTH_USER_EMAIL,
          firstName: SKIP_AUTH_USER_FIRST_NAME,
          lastName: SKIP_AUTH_USER_LAST_NAME,
        },
      }
    );
  };

  const handleLogout = async () => {
    if (isSkippingAuth) {
      setIsSkippingAuth(false);
      return;
    }

    try {
      await window.electronAPI.logout();
      // The auth-logout event will be triggered
    } catch (error) {
      console.error('Error logging out:', error);
      setError('Failed to logout');
    }
  };

  if (authStatus.authenticated || isSkippingAuth) {
    return (
      <Card className="w-full mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Shield className="h-5 w-5 text-green-600" />
              {isSkippingAuth ? 'Skipping Authentication' : 'Authenticated'}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                {isSkippingAuth ? 'Skipping Authentication' : 'Logged In'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthDetails(!showAuthDetails)}
              >
                {showAuthDetails ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {showAuthDetails && (
            <div className="space-y-3">
              {authStatus.user && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <User className="h-8 w-8 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">
                      {authStatus.user.firstName} {authStatus.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{authStatus.user.email}</p>
                    <p className="text-xs text-gray-400">ID: {authStatus.user.id}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mb-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <span>Authentication Required</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex flex-col items-start">
        <p className="text-sm text-gray-600">
          Please authenticate to access the message approval system. This will open your browser for secure login.
        </p>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 justify-center items-center w-40 self-center">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="bg-gray-200 hover:bg-gray-400 text-gray-800 w-full"
          >
            {/* <LogIn className="h-4 w-4 mr-2" /> */}
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </Button>

          <Button
            onClick={handleSkipAuth}
            disabled={isLoading}
            className="bg-gray-600 hover:bg-gray-800 text-white w-full"
          >
            Skip Authentication
          </Button>
        </div>

        <div className="text-xs text-gray-500 text-center self-center">
          <p>This will open your default browser for secure authentication.</p>
          <p>You'll be redirected back to this app after login.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuthComponent;
