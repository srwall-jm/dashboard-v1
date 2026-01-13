import { useEffect } from 'react';

// Esto soluciona el error de TypeScript "Property 'google' does not exist on type 'Window'"
declare global {
  interface Window {
    google: any;
  }
}

const GoogleLogin = () => {
  useEffect(() => {
    const renderGoogleButton = () => {
      // Si google existe y tiene accounts
      if (window.google && window.google.accounts) {
        console.log("✅ Google script detectado. Inicializando...");
        
        window.google.accounts.id.initialize({
          client_id: "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com", // <--- IMPORTANTE: REVISA ESTO
          callback: (response: any) => {
            console.log("Login exitoso. Token:", response.credential);
          }
        });

        const buttonDiv = document.getElementById("googleButtonDiv");
        
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
          });
        }
      } else {
        // Si no ha cargado, lo intentamos de nuevo en medio segundo
        console.log("⏳ Google aún no carga, reintentando...");
        setTimeout(renderGoogleButton, 500);
      }
    };

    renderGoogleButton();
  }, []);

  return <div id="googleButtonDiv" className="mt-4 h-12 w-full flex justify-center"></div>;
};

export default GoogleLogin;