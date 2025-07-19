// --- src/app.js ---
import { Conversation } from '@11labs/client';

let conversation = null;

let assistenteSignedUrl = null;


async function iniciarConexaoWebSocket(signedUrl) {
  try {
    conversation = await Conversation.startSession({
      signedUrl: signedUrl,
      onConnect: () => {
        console.log('Conectado à ElevenLabs');
        updateStatus(true);
      },
      onDisconnect: () => {
        console.log('Desconectado da ElevenLabs');
        updateStatus(false);
      },
      onError: (error) => {
        console.error('Erro na conversa:', error);
        alert('Erro na conversa');
      },
      onModeChange: (mode) => {
        updateSpeakingStatus(mode);
      }
    });
  } catch (error) {
    console.error('Falha ao iniciar conexão:', error);
  }
}
async function requestMicrophonePermission() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
}

async function getSignedUrl() {
    try {
        const response = await fetch('/api/signed-url');
        if (!response.ok) throw new Error('Failed to get signed URL');
        const data = await response.json();
        return data.signedUrl;
    } catch (error) {
        console.error('Error getting signed URL:', error);
        throw error;
    }
}

async function getAgentId() {
    const response = await fetch('/api/getAgentId');
    const { agentId } = await response.json();
    return agentId;
}

function updateStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.textContent = isConnected ? 'Conectado' : 'Desconectado';
    statusElement.classList.toggle('connected', isConnected);
}

function updateSpeakingStatus(mode) {
    const statusElement = document.getElementById('speakingStatus');
    const pulseBlurElement = document.querySelector('.pulse-blur'); // Seleciona o elemento pulse-blur

    // Verifica se o agente está falando
    const isSpeaking = mode.mode === 'speaking';
    statusElement.textContent = isSpeaking ? 'Agent Speaking' : 'Agent Silent';
    statusElement.classList.toggle('speaking', isSpeaking);

    // Mostra ou oculta a div com a classe pulse-blur
    if (isSpeaking) {
        pulseBlurElement.style.display = 'block'; // Exibe o efeito
    } else {
        pulseBlurElement.style.display = 'none'; // Oculta o efeito
    }

    console.log('Speaking status updated:', { mode, isSpeaking }); // Debug log
}


async function startConversation() {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');
    
    if (!assistenteSignedUrl) {
      alert('Signed URL do assistente não carregado ainda.');
      return;
    }

    try {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            alert('Microphone permission is required for the conversation.');
            return;
        }

        conversation = await Conversation.startSession({
            signedUrl: assistenteSignedUrl,   // usa a url salva do assistente
            onConnect: () => {
                console.log('Connected');
                updateStatus(true);
                startButton.disabled = true;
                endButton.disabled = false;
            },
            onDisconnect: () => {
                console.log('Disconnected');
                updateStatus(false);
                startButton.disabled = false;
                endButton.disabled = true;
                updateSpeakingStatus({ mode: 'listening' });
            },
            onError: (error) => {
                console.error('Conversation error:', error);
                alert('An error occurred during the conversation.');
            },
            onModeChange: (mode) => {
                console.log('Mode changed:', mode);
                updateSpeakingStatus(mode);
            }
        });
    } catch (error) {
        console.error('Error starting conversation:', error);
        alert('Failed to start conversation. Please try again.');
    }
}


async function endConversation() {
    if (conversation) {
        await conversation.endSession();
        conversation = null;
    }
}

document.getElementById('startButton').addEventListener('click', startConversation);
document.getElementById('endButton').addEventListener('click', endConversation);

window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});


window.addEventListener('DOMContentLoaded', async () => {
  const slug = window.location.pathname.split('/').filter(Boolean).pop() || '';

  if (!slug) {
    console.warn('Nenhum slug encontrado na URL, não iniciando requisição.');
    return;
  }

  try {
    const res = await fetch(`/api/assistente/${slug}`);
    if (!res.ok) throw new Error('Não foi possível carregar os dados do assistente.');

    const data = await res.json();

    document.getElementById("nome").innerText = data.nome;
    document.getElementById("descricao").innerText = data.descricao;
    document.getElementById("avatar").src = data.foto_url;
    document.body.style.backgroundImage = `url('${data.background_image}')`;

    assistenteSignedUrl = data.signed_url;  // salva aqui

  } catch (err) {
    console.error('Erro ao carregar assistente:', err);
    document.getElementById("nome").innerText = "Erro ao carregar assistente.";
  }
});
