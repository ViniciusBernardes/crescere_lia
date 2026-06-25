const chatFlow = document.getElementById('chat-flow');
const optionsGrid = document.getElementById('options-grid');
const progressBar = document.getElementById('progress-bar');

const trilha = {
    inicio: {
        text: "Olá, Eu sou a Lia, a assistente virtual da plataforma Crescere. Se você está aqui, isso importa. Estar aqui é um ato de amor e coragem. Esta é uma plataforma criada para acolher a sua jornada.",
        options: [{ label: "👉 Quero começar minha jornada", next: "humor" }]
    },
    humor: {
        text: "Antes de qualquer coisa quero saber: Como você está se sentindo hoje?",
        options: [
            { label: "😔 No limite", next: "limite" },
            { label: "🫥 Cansado(a)", next: "cansado" },
            { label: "🤔 Confuso(a)", next: "confuso" },
            { label: "🙂 Estou bem", next: "bem" },
            { label: "❓ Não sei dizer", next: "naosei" }
        ]
    },
    limite: {
        text: "Quando você está no limite, seu corpo e sua mente estão pedindo pausa, não cobrança. Vamos respirar juntos e escolher o próximo passo com calma.",
        options: [
            { label: "Sugestão: Jornada 9 — Momentos de Crise", next: "micro1_1" },
            { label: "Conhecer outras jornadas", next: "inicio" },
            { label: "Falar com um psicólogo agora", next: "sos" }
        ]
    },
    cansado: {
        text: "O cansaço é um sinal de amor prolongado sem descanso suficiente. Você não está fraco(a), está sobrecarregado(a). Vamos transformar exaustão em cuidado possível.",
        options: [{ label: "Sugestão: Jornada 5 — Cuidar de Si", next: "micro1_1" }]
    },
    micro1_1: {
        text: "Microjornada 1.1: Primeiros Passos para Entender o TEA. Conhecimento é a ferramenta para transformar dúvidas em segurança. Quer começar?",
        options: [{ label: "👍 Sim, continuar", next: "entender_tea" }]
    },
    entender_tea: {
        text: "O TEA não é uma doença, mas uma condição do neurodesenvolvimento. O cérebro funciona de um jeito diferente. O autismo não é algo que você causou.",
        options: [
            { label: "💬 Comunicação e Interação", next: "final_teste" },
            { label: "🔄 Rotinas e Comportamentos", next: "final_teste" },
            { label: "👂 Sensibilidade Sensorial", next: "final_teste" }
        ]
    },
    final_teste: {
        text: "Você está dando um passo essencial ao buscar entender. Lembre-se: conhecimento é empoderamento. Deseja seguir para a 1.2?",
        options: [
            { label: "👍 Sim, seguir para 1.2", next: "inicio" },
            { label: "🗓️ Prefiro continuar depois", next: "inicio" }
        ]
    }
};

async function typeEffect(element, text) {
    const words = text.split(" ");
    for (let word of words) {
        element.innerHTML += word + " ";
        await new Promise(r => setTimeout(r, 45));
        chatFlow.parentElement.scrollTop = chatFlow.parentElement.scrollHeight;
    }
}

async function addMessage(text, sender) {
    const row = document.createElement('div');
    row.className = `msg-row ${sender}`;
    const avatar = sender === 'luna' ? '<div class="avatar-luna"></div>' : '';
    
    row.innerHTML = `${avatar}<div class="bubble ${sender}">${sender === 'user' ? text : ''}</div>`;
    chatFlow.appendChild(row);

    if (sender === 'luna') {
        const bubble = row.querySelector('.bubble');
        await typeEffect(bubble, text);
    }
}

function renderOptions(options) {
    optionsGrid.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.innerText = opt.label;
        btn.onclick = () => selectOption(opt);
        optionsGrid.appendChild(btn);
    });
}

async function selectOption(opt) {
    if (opt.next === 'sos') return handleSOS();
    
    addMessage(opt.label, 'user');
    optionsGrid.innerHTML = '';
    
    await new Promise(r => setTimeout(r, 600));
    
    const node = trilha[opt.next];
    if (node) {
        await addMessage(node.text, 'luna');
        renderOptions(node.options);
        updateProgress();
    }
}

let progress = 10;
function updateProgress() {
    progress = Math.min(progress + 15, 100);
    progressBar.style.width = `${progress}%`;
}

function handleSOS() {
    addMessage("🆘 Acionando plantão psicológico 24h...", 'luna');
    setTimeout(() => alert("Conectando você a um profissional agora."), 500);
}

window.onload = () => {
    addMessage(trilha.inicio.text, 'luna');
    renderOptions(trilha.inicio.options);
};