export const fixCors = ({ headers, status, statusText }: ResponseInit): ResponseInit => {
  const newHeaders = new Headers(headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  return { headers: newHeaders, status, statusText };
};