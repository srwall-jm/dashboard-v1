
import { useEffect } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

interface GoogleLoginProps {
  onLoginSuccess: (token: string) => void;
}

const GoogleLogin = ({ onLoginSuccess }: GoogleLoginProps) => {
  useEffect(() => {
    const renderGoogleButton = () => {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com",
          callback: (response: any) => {
            onLoginSuccess(response.credential);
          }
        });

        const buttonDiv = document.getElementById("googleButtonDiv");
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: 250
          });
        }
      } else {
        setTimeout(renderGoogleButton, 500);
      }
    };
    renderGoogleButton();
  }, [onLoginSuccess]);

  return <div id="googleButtonDiv" className="mt-6 flex justify-center min-h-[50px]"></div>;
};

export default GoogleLogin;
