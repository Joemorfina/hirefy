import { Buffer } from 'buffer';

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
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });

  const userData = await userResp.json();
  const userId = userData.id;

  // Recebe o PDF em base64
  const { pdfBase64, fileName } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: 'PDF não enviado' });
  }

  // Usa a API da Groq para extrair e estruturar o texto do currículo
  // Envia o conteúdo base64 do PDF para a IA interpretar
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
Receberá o conteúdo de um currículo e deve extrair e estruturar as informações em texto simples.
Retorne APENAS um texto estruturado com as seguintes seções (se existirem):
NOME: 
CARGO ATUAL OU DESEJADO:
RESUMO PROFISSIONAL:
EXPERIÊNCIAS:
FORMAÇÃO:
HABILIDADES:
IDIOMAS:
Seja fiel ao conteúdo original. Não invente informações.`
          },
          {
            role: 'user',
            content: `Extraia as informações deste currículo (conteúdo em base64 — interprete como texto de currículo):\n\n${pdfBase64.substring(0, 8000)}`
          }
        ]
      })
    });

    if (!groqResp.ok) {
      const err = await groqResp.text();
      return res.status(500).json({ error: `Erro ao processar currículo: ${err}` });
    }

    const groqData = await groqResp.json();
    curriculoTexto = groqData.choices?.[0]?.message?.content || '';

    if (!curriculoTexto) {
      return res.status(500).json({ error: 'Não foi possível extrair o texto do currículo' });
    }

  } catch (err) {
    return res.status(500).json({ error: `Erro ao processar PDF: ${err.message}` });
  }

  // Salva o texto extraído no perfil do usuário
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
    return res.status(500).json({ error: `Erro ao salvar currículo: ${err}` });
  }

  return res.status(200).json({
    success: true,
    curriculo_texto: curriculoTexto
  });
}
