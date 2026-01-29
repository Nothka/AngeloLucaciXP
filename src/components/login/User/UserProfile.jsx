export const userProfile = {
  firstName: "Angelo",
  lastName: "Lucaci",
  role: "Software Developer",
  xpSuffix: "xp",
};

export const fullName = `${userProfile.firstName}${userProfile.lastName}`;

export const instructions = {
  desktop: "To begin, click your user name",
  mobile: "Tap on",
  mobileFull: `Tap on ${userProfile.firstName} to begin`,
  action: "",
};

// Product name shown in restart/shutdown labels (e.g., "Angelo XP").
export const productName = `${fullName} XP`;
export const firstName = `${userProfile.firstName}`;
