const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const dns = require('dns');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, '../dist')));

// Conexão com o banco de dados
const db = new Pool({
    host: process.env.DB_HOST,        // continua com o hostname do Supabase
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: 5432,
    ssl: { rejectUnauthorized: false },
    // 🔧 força resolução como IPv4
    lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { family: 4 }, callback);
    }
});

// Rota dinâmica para acessar assistente por slug
app.get('/api/assistente/:slug', async (req, res) => {
    const slug = req.params.slug;
    console.log(`🔍 Buscando assistente com slug: ${slug}`);

    try {
        const { rows } = await db.query('SELECT * FROM assistentes WHERE slug = $1', [slug]);
        console.log('📦 Resultado da query:', rows);

        if (rows.length === 0) {
            console.log('❌ Nenhum assistente encontrado');
            return res.status(404).send('Assistente não encontrado');
        }

        const assistente = rows[0];
        console.log('✅ Assistente encontrado:', assistente);

        const elevenResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${assistente.elevenlabs_voice_id}`,
            {
                method: 'GET',
                headers: {
                    'xi-api-key': process.env.XI_API_KEY,
                }
            }
        );

        if (!elevenResponse.ok) {
            console.error('❌ Erro ao buscar signed URL da ElevenLabs:', await elevenResponse.text());
            throw new Error('Erro ao buscar signed URL');
        }

        const data = await elevenResponse.json();

        res.json({
            nome: assistente.nome,
            descricao: assistente.descricao,
            foto_url: assistente.foto_url,
            background_image: assistente.background_image,
            voice_id: assistente.elevenlabs_voice_id,
            signed_url: data.signed_url
        });

    } catch (error) {
        console.error('💥 Erro geral:', error);
        res.status(500).json({ error: 'Erro interno ao buscar assistente' });
    }
});


// API antiga fixa (fallback)
app.get('/api/signed-url', async (req, res) => {
    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${process.env.AGENT_ID}`,
            {
                method: 'GET',
                headers: {
                    'xi-api-key': process.env.XI_API_KEY,
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to get signed URL');
        }

        const data = await response.json();
        res.json({ signedUrl: data.signed_url });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get signed URL' });
    }
});

// Retorna o agentId fixo, se necessário
app.get('/api/getAgentId', (req, res) => {
    const agentId = process.env.AGENT_ID;
    res.json({ agentId: `${agentId}` });
});

// Fallback para SPA (index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
