export const fixCors = ({ headers, status, statusText }: ResponseInit): ResponseInit => {
  const newHeaders = new Headers(headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  return { headers: newHeaders, status, statusText };
};

export const handleOPTIONS = async (): Promise<Response> => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    }
  });
};
