import type { User } from "@vendor/clerk/server";

function deriveInitials(input: {
  firstName: string | null;
  fullName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  const { firstName, fullName, lastName, username } = input;
  if (fullName) {
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (lastName) {
    return lastName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return "LF";
}

export type AccountProfileUser = Pick<
  User,
  | "createdAt"
  | "firstName"
  | "id"
  | "imageUrl"
  | "lastName"
  | "primaryEmailAddress"
  | "username"
>;

export function toAccountProfile(user: AccountProfileUser) {
  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user.firstName ?? user.lastName ?? null);

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName,
    username: user.username,
    primaryEmailAddress: user.primaryEmailAddress?.emailAddress ?? null,
    imageUrl: user.imageUrl,
    initials: deriveInitials({
      firstName: user.firstName,
      lastName: user.lastName,
      fullName,
      username: user.username,
    }),
    createdAt: new Date(user.createdAt).toISOString(),
  };
}
