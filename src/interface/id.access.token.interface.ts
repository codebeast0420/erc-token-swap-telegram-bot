export default interface IdAccessTokenInterface {
  sub: string;
  aud: string;
  tokenUse: "Id" | "Access";
  iss: string;
  username: string;
  firstName: string;
  lastName: string;
  exp?: number;
  iat?: number;
}
