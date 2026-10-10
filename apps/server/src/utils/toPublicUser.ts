type PublicUserInput = {
  id: string;
  username: string;
  email: string
}

export function toPublicUser(user: PublicUserInput) {
  return {
    id: user.id,
    username: user.username,
    email: user.email
  }
}