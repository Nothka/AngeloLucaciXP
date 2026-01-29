import React, { useEffect, useRef, useState } from "react";
import avatar from "../../assets/login-avatar.png";
import { userProfile } from "../login/User/UserProfile";

const LoginUserTile = ({
  onLogin,
  userName = userProfile.firstName,
  userRole = userProfile.role,
}) => {
  const [hovered, setHovered] = useState(false);
  const lingerTimeout = useRef(null);

  const handleEnter = () => {
    if (lingerTimeout.current) {
      clearTimeout(lingerTimeout.current);
    }
    setHovered(true);
  };

  const handleLeave = () => {
    lingerTimeout.current = setTimeout(() => {
      setHovered(false);
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (lingerTimeout.current) {
        clearTimeout(lingerTimeout.current);
      }
    };
  }, []);

  return (
    <div className="right">
      <button
        type="button"
        className={`back-gradient ${hovered ? "back-gradient--active" : ""}`}
        onClick={onLogin}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="user">
          <img src={avatar} alt={`${userName} avatar`} />
        </div>

        <div className="text-wrap">
          <div className="name">{userName}</div>
          <div className="user-title">{userRole}</div>
        </div>
      </button>
    </div>
  );
};

export default LoginUserTile;
