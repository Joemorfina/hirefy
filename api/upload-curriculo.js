export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!supabaseUrl || !supabaseKey || !groqKey) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  // Valida token do usuário
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });

  const userData = await userResp.json();
  const userId = userData.id;

  // Recebe o PDF em base64
  const { pdfBase64 } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: 'PDF não enviado' });

  // Extrai texto do PDF usando unpdf (serverless-first, sem dependências nativas)
  let textoExtraido = '';
  try {
    const { getDocument, extractText } = await import('unpdf');
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdf = await getDocument({ data: pdfBuffer }).promise;
    textoExtraido = await extractText(pdf);
    pdf.destroy();
  } catch (err) {
    return res.status(500).json({ error: `Erro ao ler PDF: ${err.message}` });
  }

  if (!textoExtraido || textoExtraido.trim().length < 50) {
    return res.status(400).json({ 
      error: 'Não foi possível extrair texto do PDF. Verifique se o arquivo não está escaneado.' 
    });
  }

  // Manda o texto extraído para a IA estruturar
  let curriculoTexto = '';
  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `Você é um extrator de informações de currículos. 
Receberá o texto bruto de um currículo e deve estruturá-lo de forma clara.
Retorne APENAS um texto estruturado com as seguintes seções (preencha só as que existirem):

NOME: 
CARGO ATUAL OU DESEJADO:
RESUMO PROFISSIONAL:
EXPERIÊNCIAS:
FORMAÇÃO:
HABILIDADES:
IDIOMAS:

Seja fiel ao conteúdo original. Não invente informações. Seja conciso.`
          },
          {
            role: 'user',
            content: `Estruture este currículo:\n\n${textoExtraido.substring(0, 4000)}`
          }
        ]
      })
    });

    if (!groqResp.ok) {
      const err = await groqResp.text();
      return res.status(500).json({ error: `Erro ao processar com IA: ${err}` });
    }

    const groqData = await groqResp.json();
    curriculoTexto = groqData.choices?.[0]?.message?.content || '';

    if (!curriculoTexto) {
      return res.status(500).json({ error: 'IA não retornou resposta' });
    }

  } catch (err) {
    return res.status(500).json({ error: `Erro na IA: ${err.message}` });
  }

  // Salva no perfil do usuário
  const patchResp = await fetch(
    `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ curriculo_texto: curriculoTexto })
    }
  );

  if (!patchResp.ok) {
    const err = await patchResp.text();
    return res.status(500).json({ error: `Erro ao salvar: ${err}` });
  }

  return res.status(200).json({ success: true, curriculo_texto: curriculoTexto });
}
