import React from "react";
import BrandPanel from "./BrandPanel";
import { fullName, instructions, userProfile } from "../login/User/UserProfile";

const LoginBrand = ({
  userName = fullName,
  role = userProfile.role,
  xpSuffix = userProfile.xpSuffix,
  instructionDesktop = instructions.desktop,
  instructionMobile = instructions.mobile,
  instructionAction = instructions.action,
}) => {
  return (
    <BrandPanel
      name={userName}
      role={role}
      xpSuffix={xpSuffix}
      instructionDesktop={instructionDesktop}
      instructionMobile={instructionMobile}
      instructionAction={instructionAction}
    />
  );
};

export default LoginBrand;