import React, { useState } from 'react';
import { Fade } from '@mui/material';
import Login from './Login';
import Register from './Register';

const AuthWrapper = () => {
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSwitchToRegister = () => {
    setIsRegistering(true);
  };

  const handleSwitchToLogin = () => {
    setIsRegistering(false);
  };

  return (
    <>
      <Fade in={!isRegistering} timeout={300} unmountOnExit>
        <div>
          <Login onSwitchToRegister={handleSwitchToRegister} />
        </div>
      </Fade>
      <Fade in={isRegistering} timeout={300} unmountOnExit>
        <div>
          <Register onSwitchToLogin={handleSwitchToLogin} />
        </div>
      </Fade>
    </>
  );
};

export default AuthWrapper;