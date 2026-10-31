const HAFAS_ENDPOINT = 'https://mobil.rozklad-pkp.pl:8019/bin/mgate.exe';

const userAgentDeviceStrings = [
  'Linux; U; Android 15; 2210132C Build/AQ3A.240912.001',
  'Linux; U; Android 14; 23116PN5BC Build/UKQ1.230804.001',
  'Linux; U; Android 14; moto g 5G - 2024 Build/U1UFNS34.41-98-3-13',
  'Linux; U; Android 13; V2238A Build/UP1A.231005.007',
  'Linux; U; Android 15; 23090RA98C Build/UP1A.231005.007',
];

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/status' || request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', message: 'PKP HAFAS Proxy is running' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (request.method === 'POST') {
      try {
        let body = await request.json();
        body.auth = { type: 'AID', aid: 'DrxJYtYZQpEBCtcb' };
        body.client = { type: 'AND', id: 'HAFAS' };
        body.ver = '1.21';
        body.lang = body.lang || 'pl';
        const bodyText = JSON.stringify(body);

        const deviceString = userAgentDeviceStrings[Math.floor(Math.random() * userAgentDeviceStrings.length)];
        const userAgent = `Dalvik/2.1.0 (${deviceString})`;

        const hafasResponse = await fetch(HAFAS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': userAgent,
            'Accept': 'application/json',
            'Connection': 'keep-alive',
          },
          body: bodyText,
        });

        const hafasResponseText = await hafasResponse.text();
        console.log('PKP status:', hafasResponse.status);
        console.log('PKP response:', hafasResponseText.slice(0, 500));

        return new Response(hafasResponseText, {
          status: hafasResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  },
};