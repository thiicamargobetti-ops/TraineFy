import { useState, useEffect } from “react”;

const STORAGE_KEY = “gymlog_workouts_v1”;
const memoryStore = {};
const storage = {
get(key) {
try { const v = window.localStorage.getItem(key); return v !== null ? v : memoryStore[key] ?? null; } catch (*) { return memoryStore[key] ?? null; }
},
set(key, value) {
try { window.localStorage.setItem(key, value); } catch (*) {}
memoryStore[key] = value;
},
};

const WEEKDAYS = [“Seg”, “Ter”, “Qua”, “Qui”, “Sex”, “Sáb”, “Dom”];

const EXERCISE_LIBRARY = {
Peito: [
{ name: “Supino Reto com Barra”, unit: “kg”, desc: “Deitado no banco, desce a barra até o peito e empurra de volta. Exercício base para força e massa do peitoral.” },
{ name: “Supino Inclinado com Barra”, unit: “kg”, desc: “Banco a ~30–45°, foco na porção superior do peitoral. Empurra a barra do peito alto até extensão total.” },
{ name: “Supino Declinado com Barra”, unit: “kg”, desc: “Banco inclinado para baixo, trabalha a porção inferior do peitoral. Menor amplitude que o reto.” },
{ name: “Supino Reto com Halteres”, unit: “kg”, desc: “Igual ao supino com barra, mas halteres permitem maior amplitude e recrutam mais estabilizadores.” },
{ name: “Supino Inclinado com Halteres”, unit: “kg”, desc: “Banco inclinado com halteres. Ótimo para peito superior com liberdade de movimento maior que a barra.” },
{ name: “Supino Declinado com Halteres”, unit: “kg”, desc: “Banco declinado com halteres. Trabalha peito inferior com amplitude extra em relação à barra.” },
{ name: “Press na Máquina (Chest Press)”, unit: “kg”, desc: “Movimento de empurrar em máquina guiada. Seguro e eficaz para isolar o peitoral sem exigir equilíbrio.” },
{ name: “Press no Smith Machine”, unit: “kg”, desc: “Supino no smith machine. Movimento fixo e seguro, útil para treinar sozinho ou em reabilitação.” },
{ name: “Crucifixo com Halteres”, unit: “kg”, desc: “Deitado no banco, abre os halteres em arco até sentir o alongamento do peitoral. Isola bem o músculo.” },
{ name: “Crucifixo Inclinado com Halteres”, unit: “kg”, desc: “Versão inclinada do crucifixo. Foco na cabeça clavicular (parte superior) do peitoral.” },
{ name: “Peck Deck (Fly na Máquina)”, unit: “kg”, desc: “Máquina de abrir e fechar. Isola o peitoral com menor risco que o crucifixo livre com pesos.” },
{ name: “Crossover Alto (Cabo)”, unit: “kg”, desc: “Cabo puxado de cima para baixo cruzando na frente. Trabalha a porção inferior e medial do peitoral.” },
{ name: “Crossover Baixo (Cabo)”, unit: “kg”, desc: “Cabo puxado de baixo para cima cruzando na frente. Trabalha a porção superior e medial do peitoral.” },
{ name: “Flexão de Braço (Push-up)”, unit: “reps”, desc: “No chão, empurra o corpo com as mãos. Clássico do bodyweight que trabalha peito, tríceps e deltóide.” },
{ name: “Flexão com Pés Elevados”, unit: “reps”, desc: “Pés em plataforma elevada, mãos no chão. Aumenta o ângulo e recruta mais a parte superior do peito.” },
{ name: “Flexão Diamante”, unit: “reps”, desc: “Mãos juntas formando diamante. Aumenta muito o foco em tríceps e porção medial do peitoral.” },
{ name: “Dip em Paralelas (foco peito)”, unit: “reps”, desc: “Corpo inclinado para frente nas barras paralelas. Trabalha fortemente o peitoral inferior e tríceps.” },
{ name: “Pullover com Halter”, unit: “kg”, desc: “Deitado no banco transversal, desce o halter atrás da cabeça em arco. Trabalha peito e serrátil.” },
],
Costas: [
{ name: “Pulldown (Puxada Frontal)”, unit: “kg”, desc: “Puxa a barra da polia alta até o peito. Exercício base para latíssimo do dorso com excelente amplitude.” },
{ name: “Pull-up (Barra Fixa Pronada)”, unit: “reps”, desc: “Tração na barra com pegada pronada (palmas para frente). Exercício rei para costas e bíceps.” },
{ name: “Chin-up (Barra Fixa Supinada)”, unit: “reps”, desc: “Tração com palmas viradas para você. Maior recrutamento de bíceps que o pull-up pronado.” },
{ name: “Pulldown Pegada Neutra”, unit: “kg”, desc: “Puxada com pegada neutra (palmas se olhando). Reduz tensão no cotovelo e recruta bem o lat.” },
{ name: “Straight Arm Pulldown”, unit: “kg”, desc: “Cabo alto, braços estendidos, empurra de cima para baixo. Isola o lat sem recrutamento de bíceps.” },
{ name: “Remada Curvada com Barra”, unit: “kg”, desc: “Tronco inclinado, puxa a barra até o abdômen. Exercício composto essencial para espessura das costas.” },
{ name: “Remada Unilateral com Halter”, unit: “kg”, desc: “Um joelho no banco, puxa o halter até o quadril. Ótimo para corrigir assimetrias e trabalhar unilateral.” },
{ name: “Remada Baixa no Cabo (Seated Row)”, unit: “kg”, desc: “Sentado na polia baixa, puxa o cabo até o abdômen. Bom controle de movimento e tensão constante.” },
{ name: “Remada na Máquina (Chest Supported)”, unit: “kg”, desc: “Peito apoiado no banco inclinado, remada com halteres ou cabo. Remove a lombar da equação.” },
{ name: “Remada T-Bar”, unit: “kg”, desc: “Barra fixada no chão ou em equipamento específico. Muito usada para espessura das costas com carga alta.” },
{ name: “Remada Pendlay”, unit: “kg”, desc: “Barra no chão a cada rep, puxada explosiva até o abdômen. Versão mais técnica e potente da remada curvada.” },
{ name: “Remada Invertida (Bodyweight)”, unit: “reps”, desc: “Deitado sob uma barra fixa, puxa o corpo para cima. Boa progressão antes de dominar a tração completa.” },
{ name: “Levantamento Terra (Deadlift)”, unit: “kg”, desc: “Exercício rei do corpo todo. Puxa a barra do chão com quadril e costas, ativa praticamente todos os músculos.” },
{ name: “Deadlift Romeno”, unit: “kg”, desc: “Barra desce pela frente com joelhos levemente flexionados. Foco nos isquiotibiais, glúteos e lombar.” },
{ name: “Deadlift Sumo”, unit: “kg”, desc: “Postura larga com pés para fora. Reduz amplitude e tensão lombar, aumenta recrutamento de glúteos e adutores.” },
{ name: “Hiperextensão no Banco Romano”, unit: “reps”, desc: “Tronco desce e sobe no banco específico. Isola e fortalece os extensores da coluna e glúteos.” },
{ name: “Good Morning”, unit: “kg”, desc: “Barra nas costas, dobra o tronco para frente mantendo coluna neutra. Foco em lombar e isquiotibiais.” },
{ name: “Pullover na Polia”, unit: “kg”, desc: “Polia alta, braços em arco de cima para baixo. Isola o lat e o serrátil anterior com tensão constante.” },
],
Quadríceps: [
{ name: “Agachamento Livre com Barra”, unit: “kg”, desc: “Barra nas costas, desce até pelo menos paralelo. O rei dos exercícios para pernas, glúteos e core.” },
{ name: “Agachamento Frontal”, unit: “kg”, desc: “Barra na frente, na altura dos ombros. Maior ativação de quadríceps e exige mais mobilidade de tornozelo.” },
{ name: “Agachamento Goblet”, unit: “kg”, desc: “Halter ou kettlebell no peito, postura ereta. Ótimo para aprender o padrão de agachamento com segurança.” },
{ name: “Agachamento Hack com Barra”, unit: “kg”, desc: “Barra atrás das pernas, sobe e desce. Foco nos quadríceps com menos estresse na lombar.” },
{ name: “Agachamento no Smith Machine”, unit: “kg”, desc: “Agachamento no trilho fixo. Permite explorar ângulos diferentes e útil para iniciantes ou reabilitação.” },
{ name: “Leg Press 45°”, unit: “kg”, desc: “Empurra a plataforma inclinada com as pernas. Muito cargado, excelente para volume de quadríceps e glúteos.” },
{ name: “Leg Press Horizontal”, unit: “kg”, desc: “Versão horizontal do leg press. Menor compressão articular, bom para quem tem limitações no joelho.” },
{ name: “Hack Squat na Máquina”, unit: “kg”, desc: “Máquina específica com costas apoiadas. Movimento guiado que isola muito bem os quadríceps.” },
{ name: “Extensão de Pernas (Leg Extension)”, unit: “kg”, desc: “Máquina de extensão de joelho. Isolamento direto do quadríceps, ideal para finalização do treino.” },
{ name: “Avanço com Barra (Lunge)”, unit: “kg”, desc: “Passo à frente com barra nas costas. Trabalha quadríceps, glúteos e equilíbrio unilateral.” },
{ name: “Avanço com Halteres”, unit: “kg”, desc: “Mesmo padrão do lunge, mas com halteres. Mais liberdade de movimento e recrutamento de estabilizadores.” },
{ name: “Avanço Reverso”, unit: “kg”, desc: “Passo para trás no lugar de para frente. Menor tensão no joelho e maior recrutamento de glúteo.” },
{ name: “Passada Búlgara (Bulgarian Split Squat)”, unit: “kg”, desc: “Pé traseiro elevado no banco, desce com a perna da frente. Exercício unilateral brutal para pernas e glúteos.” },
{ name: “Step-up no Banco”, unit: “reps”, desc: “Sobe o degrau ou banco com uma perna por vez. Funcional, trabalha quad, glúteo e equilíbrio unilateral.” },
{ name: “Sissy Squat”, unit: “reps”, desc: “Joelhos projetados para frente, calcanhares elevados. Isola intensamente os quadríceps, exige muito equilíbrio.” },
{ name: “Agachamento Sumô”, unit: “kg”, desc: “Postura bem aberta com pés para fora. Recruta mais adutores e glúteos além do quad.” },
],
“Post. Coxa”: [
{ name: “Mesa Flexora (Leg Curl Deitado)”, unit: “kg”, desc: “Deitado, curla as pernas contra resistência. Isolamento direto dos isquiotibiais com boa amplitude.” },
{ name: “Cadeira Flexora (Leg Curl Sentado)”, unit: “kg”, desc: “Sentado, curla as pernas. Posição alonga mais o isquio no início do movimento do que a mesa flexora.” },
{ name: “Leg Curl na Polia em Pé”, unit: “kg”, desc: “Em pé, curla uma perna por vez no cabo. Versão unilateral que recruta também estabilizadores do core.” },
{ name: “Deadlift Romeno (foco isquio)”, unit: “kg”, desc: “Barra ou halteres, desce pela frente com leve flexão dos joelhos. Ótimo para isquiotibiais e lombar.” },
{ name: “Stiff”, unit: “kg”, desc: “Joelhos bem retos, desce a barra pela frente. Isquiotibiais em máximo alongamento com alta tensão.” },
{ name: “Glute-Ham Raise (GHR)”, unit: “reps”, desc: “Máquina específica, desce e sobe usando isquios. Exercício avançado e extremamente eficaz para o posterior.” },
{ name: “Nordic Curl”, unit: “reps”, desc: “Joelhos no chão, segura os calcanhares e desce com o corpo. Isquio excêntrico intenso, previne lesões.” },
{ name: “Good Morning”, unit: “kg”, desc: “Barra nas costas, inclina o tronco para frente. Ativa isquiotibiais e extensores da coluna de forma integrada.” },
{ name: “Single-leg Hip Thrust”, unit: “kg”, desc: “Elevação de quadril com uma perna. Intensifica o trabalho de glúteo e isquio unilateralmente.” },
],
Glúteos: [
{ name: “Hip Thrust com Barra”, unit: “kg”, desc: “Ombros no banco, barra no quadril, empurra para cima. Exercício número 1 para desenvolvimento de glúteos.” },
{ name: “Hip Thrust na Máquina”, unit: “kg”, desc: “Versão guiada do hip thrust. Mais seguro e fácil de carregar, ótimo para volume alto de glúteo.” },
{ name: “Glute Bridge”, unit: “reps”, desc: “Deitado no chão, eleva o quadril. Versão mais acessível do hip thrust, bom para iniciantes e ativação.” },
{ name: “Agachamento Búlgaro (foco glúteo)”, unit: “kg”, desc: “Pé traseiro elevado, tronco levemente inclinado. Potente para glúteo e isquio unilateral.” },
{ name: “Kickback no Cabo”, unit: “kg”, desc: “Em 4 apoios ou em pé, chuta a perna para trás no cabo. Isola o glúteo máximo com boa amplitude.” },
{ name: “Abdução de Quadril na Máquina”, unit: “kg”, desc: “Sentado, abre as pernas contra resistência. Trabalha glúteo médio e mínimo — essenciais para formato do quadril.” },
{ name: “Abdução no Cabo (lateral)”, unit: “kg”, desc: “Em pé, afasta a perna lateralmente no cabo. Glúteo médio em foco, bom para estabilidade e forma.” },
{ name: “Monster Walk com Elástico”, unit: “reps”, desc: “Elástico nos tornozelos ou joelhos, anda de lado. Ativa o glúteo médio e é ótimo para aquecimento.” },
{ name: “Clamshell com Elástico”, unit: “reps”, desc: “Deitado de lado, elástico acima dos joelhos, abre e fecha. Foco no glúteo médio e rotadores do quadril.” },
{ name: “Step-up (foco glúteo)”, unit: “reps”, desc: “Sobe no banco projetando o quadril para frente. Ótimo funcional que recruta muito glúteo e quad.” },
],
Panturrilha: [
{ name: “Elevação em Pé (Standing Calf Raise)”, unit: “kg”, desc: “Em pé, sobe nas pontas dos pés. Base para panturrilha, trabalha o gastrocnêmio (músculo superficial).” },
{ name: “Elevação Sentado (Seated Calf Raise)”, unit: “kg”, desc: “Sentado com resistência nos joelhos, sobe nas pontas. Foco no sóleo, músculo mais profundo da panturrilha.” },
{ name: “Leg Press Calf Raise”, unit: “kg”, desc: “No leg press, empurra a plataforma apenas com a ponta dos pés. Alta carga possível para o gastrocnêmio.” },
{ name: “Elevação Unilateral com Halter”, unit: “kg”, desc: “Uma perna por vez, halter na mão. Corrige assimetrias e aumenta a amplitude do movimento.” },
{ name: “Elevação no Smith Machine”, unit: “kg”, desc: “Pés em step ou placa, eleva nas pontas no smith. Carga controlada com ótima amplitude de movimento.” },
{ name: “Donkey Calf Raise”, unit: “kg”, desc: “Tronco inclinado, peso nas costas, eleva as pontas. Ativa mais o gastrocnêmio pelo ângulo do quadril flexionado.” },
],
Bíceps: [
{ name: “Rosca Direta com Barra”, unit: “kg”, desc: “Em pé, curla a barra com pegada supinada. Clássico para massa de bíceps, permite carga alta.” },
{ name: “Rosca Direta com Halteres”, unit: “kg”, desc: “Curla bilateral com halteres. Permite supinação completa no topo para máxima contração do bíceps.” },
{ name: “Rosca Alternada com Halteres”, unit: “kg”, desc: “Um braço por vez. Melhor foco e possibilidade de supinação completa em cada repetição.” },
{ name: “Rosca Martelo (Hammer Curl)”, unit: “kg”, desc: “Pegada neutra (polegar para cima). Trabalha braquial e braquiorradial além do bíceps.” },
{ name: “Rosca Concentrada”, unit: “kg”, desc: “Cotovelo apoiado na coxa, curla o halter. Isola ao máximo o bíceps eliminando impulso do corpo.” },
{ name: “Rosca Scott com Barra”, unit: “kg”, desc: “Braços apoiados no banco inclinado. Remove o impulso dos ombros e foca totalmente no bíceps.” },
{ name: “Rosca Scott na Máquina”, unit: “kg”, desc: “Versão guiada da rosca scott. Muito segura e eficaz para isolar o bíceps sem compensações.” },
{ name: “Rosca no Cabo Baixo”, unit: “kg”, desc: “Polia na posição baixa, curla em pé. Tensão constante ao longo de todo o movimento.” },
{ name: “Rosca Spider (Cabo Alto)”, unit: “kg”, desc: “Peito apoiado em banco inclinado, curla com cabo ou halteres. Bíceps em posição encurtada durante toda a rep.” },
{ name: “Rosca Inversa (Reverse Curl)”, unit: “kg”, desc: “Pegada pronada, curla a barra ou halteres. Foco em braquiorradial e bíceps porção longa.” },
{ name: “Rosca Zottman”, unit: “kg”, desc: “Curla com supinação e desce com pronação. Trabalha bíceps na subida e braquiorradial na descida.” },
{ name: “Rosca Inclinada com Halteres”, unit: “kg”, desc: “Deitado em banco inclinado, braços caem para trás. Maior alongamento do bíceps, excelente para hipertrofia.” },
{ name: “Rosca 21”, unit: “kg”, desc: “7 parciais baixas + 7 parciais altas + 7 completas com barra. Método de intensidade para estimular o bíceps de formas distintas.” },
],
Tríceps: [
{ name: “Tríceps Testa com Barra (Skull Crusher)”, unit: “kg”, desc: “Deitado, desce a barra até a testa e empurra de volta. Exercício base para massa de tríceps com carga alta.” },
{ name: “Tríceps Testa com Halteres”, unit: “kg”, desc: “Versão com halteres do skull crusher. Permite mais liberdade de movimento e é mais gentil com os cotovelos.” },
{ name: “Pushdown no Cabo (Barra Reta)”, unit: “kg”, desc: “Em pé, empurra a barra do cabo para baixo. Clássico isolador de tríceps, ótimo para pump e finalização.” },
{ name: “Pushdown com Corda”, unit: “kg”, desc: “Mesmo padrão, mas com corda que abre no final. Maior amplitude e melhor contração da cabeça lateral.” },
{ name: “Extensão sobre a Cabeça com Halter”, unit: “kg”, desc: “Halter atrás da cabeça, empurra para cima. Trabalha a cabeça longa do tríceps em alongamento máximo.” },
{ name: “Extensão sobre a Cabeça no Cabo”, unit: “kg”, desc: “Cabo atrás da cabeça, empurra para frente e para cima. Tensão constante com foco na cabeça longa.” },
{ name: “Dip em Paralelas (foco tríceps)”, unit: “reps”, desc: “Corpo reto nas barras, cotovelos para trás. Excelente para volume e carga no tríceps como um todo.” },
{ name: “Tríceps Coice (Kickback)”, unit: “kg”, desc: “Tronco inclinado, estende o braço para trás com halter. Isolamento do tríceps no pico de contração.” },
{ name: “Close Grip Bench Press”, unit: “kg”, desc: “Supino com pegada fechada. Composto que trabalha tríceps com alta carga junto ao peitoral medial.” },
{ name: “Extensão de Tríceps na Máquina”, unit: “kg”, desc: “Máquina guiada para extensão de cotovelo. Segura e eficaz, ótima para iniciantes ou finalização.” },
{ name: “Tríceps Francês com Barra EZ”, unit: “kg”, desc: “Deitado ou sentado, barra EZ desce atrás da cabeça. Variação confortável do skull crusher para os pulsos.” },
],
Ombros: [
{ name: “Desenvolvimento Militar com Barra (OHP)”, unit: “kg”, desc: “Em pé ou sentado, empurra a barra de cima dos ombros até extensão. O principal compound para deltóides.” },
{ name: “Desenvolvimento com Halteres”, unit: “kg”, desc: “Sentado ou em pé, empurra os halteres para cima. Maior amplitude que a barra e trabalha estabilizadores.” },
{ name: “Desenvolvimento Arnold”, unit: “kg”, desc: “Começa com palmas para você e gira durante o press. Trabalha todo o deltóide em uma amplitude maior.” },
{ name: “Elevação Lateral com Halteres”, unit: “kg”, desc: “Braços abertos lateralmente até a altura dos ombros. Isolamento direto do deltóide médio — essencial para largura.” },
{ name: “Elevação Lateral no Cabo”, unit: “kg”, desc: “Mesmo movimento no cabo. Tensão constante ao longo do movimento, especialmente eficaz para deltóide médio.” },
{ name: “Elevação Lateral na Máquina”, unit: “kg”, desc: “Máquina guiada para elevar os braços. Mais segura que os halteres e boa para alto volume.” },
{ name: “Elevação Frontal com Halter”, unit: “kg”, desc: “Braço sobe para frente até a altura dos ombros. Foco no deltóide anterior, evitar balançar o tronco.” },
{ name: “Elevação Frontal com Barra”, unit: “kg”, desc: “Igual com halter, mas barra permite mais carga. Ativa também o trapézio e bíceps como assistentes.” },
{ name: “Fly Invertido (Deltóide Posterior)”, unit: “kg”, desc: “Tronco inclinado, abre os braços para trás. Isola o deltóide posterior, muito importante para postura.” },
{ name: “Face Pull no Cabo”, unit: “kg”, desc: “Cabo na altura do rosto, puxa em direção à testa com corda. Trabalha deltóide posterior e manguito rotador.” },
{ name: “Fly Invertido na Máquina”, unit: “kg”, desc: “Máquina peck deck ao contrário. Isola o deltóide posterior com segurança e facilidade de execução.” },
{ name: “Remada Alta (Upright Row)”, unit: “kg”, desc: “Barra ou halteres sobem pela frente até o queixo. Trabalha trapézio superior e deltóide médio. Atenção à postura.” },
{ name: “Push Press”, unit: “kg”, desc: “Développé com impulso das pernas. Permite mais carga que o overhead press estrito, ótimo para potência.” },
],
Trapézio: [
{ name: “Encolhimento com Barra (Shrug)”, unit: “kg”, desc: “Em pé, eleva os ombros em direção às orelhas. Isolamento direto do trapézio superior com alta carga.” },
{ name: “Encolhimento com Halteres”, unit: “kg”, desc: “Igual ao shrug com barra, mas halteres permitem mais liberdade e amplitude do movimento.” },
{ name: “Shrug no Smith Machine”, unit: “kg”, desc: “Shrug guiado no smith. Seguro para cargas muito altas sem preocupação com equilíbrio da barra.” },
{ name: “Farmer’s Walk”, unit: “kg”, desc: “Carrega halteres pesados e caminha. Trabalha trapézio, core e todo o grip de forma funcional.” },
{ name: “Face Pull (ênfase trapézio médio)”, unit: “kg”, desc: “Cabo na altura do rosto, puxado com corda. Ativa trapézio médio e inferior além de deltóide posterior.” },
{ name: “Remada Alta (Upright Row)”, unit: “kg”, desc: “Barra sobe pelo corpo até o queixo. Recrutamento de trapézio superior junto com deltóide médio.” },
],
Antebraço: [
{ name: “Rosca de Punho (Wrist Curl)”, unit: “kg”, desc: “Antebraços apoiados, curla o punho para cima com barra ou halter. Trabalha os flexores do antebraço.” },
{ name: “Rosca de Punho Inverso”, unit: “kg”, desc: “Mesma posição, mas curla para baixo (extensão). Trabalha os extensores do antebraço.” },
{ name: “Rosca Inversa (Reverse Curl)”, unit: “kg”, desc: “Curla a barra com pegada pronada. Bíceps + braquiorradial + extensores do antebraço em conjunto.” },
{ name: “Farmer’s Walk”, unit: “kg”, desc: “Carrega peso pesado e caminha. O melhor funcional para grip, antebraço e força de preensão.” },
{ name: “Dead Hang na Barra”, unit: “seg”, desc: “Suspende o corpo na barra pelo maior tempo possível. Desenvolve grip, descomprime coluna e fortalece antebraço.” },
{ name: “Plate Pinch”, unit: “seg”, desc: “Segura dois discos lisos pela borda com polegar e dedos. Excelente para força de pinça do antebraço.” },
{ name: “Squeeze de Grip (Gripper)”, unit: “reps”, desc: “Aperta e solta o gripper repetidas vezes. Simples e eficaz para aumentar a força de fechamento da mão.” },
],
Core: [
{ name: “Crunch no Chão”, unit: “reps”, desc: “Eleva o tronco parcialmente do chão contraindo o abdômen. Básico e eficaz para o reto abdominal.” },
{ name: “Crunch na Máquina”, unit: “kg”, desc: “Máquina de abdômen guiada. Permite carga progressiva no reto abdominal com segurança.” },
{ name: “Crunch no Cabo”, unit: “kg”, desc: “De joelhos, puxa o cabo com a cabeça. Carga no reto abdominal superior com fácil progressão de peso.” },
{ name: “Sit-up”, unit: “reps”, desc: “Abdômen completo, eleva o tronco até os joelhos. Maior amplitude que o crunch, envolve também o iliopsoas.” },
{ name: “Bicycle Crunch”, unit: “reps”, desc: “Crunch com rotação alternando cotovelo ao joelho oposto. Trabalha reto e oblíquos simultaneamente.” },
{ name: “Prancha Frontal (Plank)”, unit: “seg”, desc: “Apoio no antebraço, corpo reto. Exercício isométrico de core, trabalha toda a musculatura estabilizadora.” },
{ name: “Prancha Lateral”, unit: “seg”, desc: “Apoio em um antebraço, corpo em linha lateral. Isola os oblíquos e quadrado lombar de forma isométrica.” },
{ name: “Dead Bug”, unit: “reps”, desc: “Deitado, braço e perna opostos se estendem sem tocar o chão. Estabilização de core com foco em antiextensão.” },
{ name: “Bird Dog”, unit: “reps”, desc: “Em 4 apoios, estende braço e perna opostos. Equilíbrio e estabilização de core com ativação de lombar e glúteo.” },
{ name: “Ab Wheel Rollout”, unit: “reps”, desc: “Roda de abdômen, empurra para frente e puxa de volta. Um dos melhores exercícios para força e estabilidade do core.” },
{ name: “Pallof Press no Cabo”, unit: “kg”, desc: “Segura o cabo na frente do peito e estende os braços. Antirotação pura — desafia os oblíquos de forma funcional.” },
{ name: “Elevação de Pernas Suspenso”, unit: “reps”, desc: “Suspenso na barra, eleva as pernas até o paralelo ou além. Trabalha reto inferior e iliopsoas com alta dificuldade.” },
{ name: “Elevação de Joelhos Suspenso”, unit: “reps”, desc: “Igual ao anterior, mas com joelhos dobrados. Versão mais acessível para iniciantes no exercício suspenso.” },
{ name: “Reverse Crunch”, unit: “reps”, desc: “Deitado, eleva os joelhos em direção ao peito. Foco na porção inferior do reto abdominal.” },
{ name: “Russian Twist”, unit: “kg”, desc: “Sentado inclinado, gira o tronco com disco ou medicine ball. Oblíquos em foco com componente rotacional.” },
{ name: “Woodchop no Cabo”, unit: “kg”, desc: “Cabo em diagonal, puxa de cima para baixo (ou baixo para cima). Movimento rotacional funcional para oblíquos e core.” },
{ name: “Side Bend com Halter”, unit: “kg”, desc: “Em pé, inclina o tronco lateralmente com halter. Trabalha o oblíquo e o quadrado lombar do lado oposto.” },
],
};

const MUSCLE_COLORS = {
Peito: “#f97316”, Costas: “#3b82f6”, Quadríceps: “#eab308”,
“Post. Coxa”: “#f59e0b”, Glúteos: “#ec4899”, Panturrilha: “#14b8a6”,
Bíceps: “#a78bfa”, Tríceps: “#6366f1”, Ombros: “#a855f7”,
Trapézio: “#64748b”, Antebraço: “#0ea5e9”, Core: “#ef4444”,
};

const GROUP_ORDER = [“Peito”, “Costas”, “Quadríceps”, “Post. Coxa”, “Glúteos”, “Panturrilha”, “Bíceps”, “Tríceps”, “Ombros”, “Trapézio”, “Antebraço”, “Core”];

function genId() { return Math.random().toString(36).slice(2, 9); }

function makeEx(name, group, sets, reps, unit = “kg”) {
return { id: genId(), name, group, sets, reps, unit, weight: null, setWeights: Array(sets).fill(””), done: [] };
}

const DEFAULT_WORKOUTS = {
// SEGUNDA / QUINTA — Braço + Costas
Seg: [
makeEx(“Rosca Direta com Barra”,         “Bíceps”,    4, 12),
makeEx(“Rosca Inclinada com Halteres”,    “Bíceps”,    3, 15),
makeEx(“Tríceps Testa com Halteres”,      “Tríceps”,   4, 10),
makeEx(“Pushdown no Cabo (Barra Reta)”,   “Tríceps”,   3, 15),
makeEx(“Elevação Sentado (Seated Calf Raise)”, “Panturrilha”, 3, 15),
makeEx(“Crunch no Cabo”,                  “Core”,      3, 12),
],
// TERÇA / SEXTA — Peito + Ombro
Ter: [
makeEx(“Supino Inclinado com Barra”,      “Peito”,     4, 10),
makeEx(“Peck Deck (Fly na Máquina)”,      “Peito”,     3, 15),
makeEx(“Crossover Baixo (Cabo)”,          “Peito”,     3, 15),
makeEx(“Desenvolvimento com Halteres”,    “Ombros”,    4, 12),
makeEx(“Elevação Lateral no Cabo”,        “Ombros”,    3, 15),
makeEx(“Leg Press 45°”,                   “Quadríceps”,4, 12),
makeEx(“Woodchop no Cabo”,                “Core”,      3, 12),
],
// QUARTA — Costas + Perna
Qua: [
makeEx(“Pulldown (Puxada Frontal)”,       “Costas”,    4, 10),
makeEx(“Remada Baixa no Cabo (Seated Row)”,“Costas”,   4, 12),
makeEx(“Stiff”,                           “Post. Coxa”,4, 10),
makeEx(“Hip Thrust com Barra”,            “Glúteos”,   4, 12),
makeEx(“Face Pull no Cabo”,               “Ombros”,    3, 15),
makeEx(“Encolhimento com Halteres”,       “Trapézio”,  3, 12),
makeEx(“Rosca de Punho (Wrist Curl)”,     “Antebraço”, 2, 15),
makeEx(“Crunch no Cabo”,                  “Core”,      3, 12),
],
};

// Quinta = cópia de Segunda, Sexta = cópia de Terça
DEFAULT_WORKOUTS.Qui = DEFAULT_WORKOUTS.Seg.map(e => ({ …e, id: genId(), setWeights: […e.setWeights], done: [] }));
DEFAULT_WORKOUTS.Sex = DEFAULT_WORKOUTS.Ter.map(e => ({ …e, id: genId(), setWeights: […e.setWeights], done: [] }));
DEFAULT_WORKOUTS.Sáb = [];
DEFAULT_WORKOUTS.Dom = [];

function emptyWorkouts() {
return WEEKDAYS.reduce((acc, d) => ({ …acc, [d]: [] }), {});
}

function loadWorkouts() {
try {
const saved = storage.get(STORAGE_KEY);
if (saved) return JSON.parse(saved);
} catch (_) {}
return { …emptyWorkouts(), …DEFAULT_WORKOUTS };
}

// ── STEPPER ────────────────────────────────────────────────────────────────
function Stepper({ label, val, onDec, onInc }) {
return (
<div style={{ background: “#1f2937”, borderRadius: 10, padding: 12, display: “flex”, flexDirection: “column”, alignItems: “center”, gap: 8 }}>
<span style={{ fontSize: 11, color: “#6b7280” }}>{label}</span>
<div style={{ display: “flex”, alignItems: “center”, gap: 8 }}>
<button onClick={onDec} style={{ background: “#374151”, border: “none”, borderRadius: 6, width: 26, height: 26, color: “#fff”, cursor: “pointer”, fontSize: 18, display: “flex”, alignItems: “center”, justifyContent: “center” }}>−</button>
<span style={{ fontSize: 22, fontWeight: 700, color: “#f9fafb”, minWidth: 24, textAlign: “center” }}>{val}</span>
<button onClick={onInc} style={{ background: “#374151”, border: “none”, borderRadius: 6, width: 26, height: 26, color: “#fff”, cursor: “pointer”, fontSize: 18, display: “flex”, alignItems: “center”, justifyContent: “center” }}>+</button>
</div>
</div>
);
}

// ── CONFIG STEP (shared between library and custom) ────────────────────────
function ConfigStep({ name, group, unit, desc, sets, reps, weight, setSets, setReps, setWeight, onBack, onConfirm }) {
const color = MUSCLE_COLORS[group] || “#6b7280”;
return (
<>
<button onClick={onBack} style={{ background: “none”, border: “none”, color: “#6b7280”, fontSize: 13, cursor: “pointer”, padding: 0, marginBottom: 16 }}>← voltar</button>
<div style={{ background: “#1f2937”, borderRadius: 12, padding: 16, marginBottom: 20 }}>
<p style={{ margin: “0 0 4px”, fontSize: 11, color }}>{group}</p>
<p style={{ margin: “0 0 6px”, fontSize: 22, fontWeight: 700, color: “#f9fafb” }}>{name}</p>
{desc && <p style={{ margin: 0, fontSize: 12, color: “#6b7280”, lineHeight: 1.5 }}>{desc}</p>}
</div>
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr 1fr”, gap: 10, marginBottom: 20 }}>
<Stepper label=“Séries” val={sets} onDec={() => setSets(v => Math.max(1, v - 1))} onInc={() => setSets(v => Math.min(10, v + 1))} />
<Stepper label=“Reps”   val={reps} onDec={() => setReps(v => Math.max(1, v - 1))} onInc={() => setReps(v => Math.min(50, v + 1))} />
<div style={{ background: “#1f2937”, borderRadius: 10, padding: 12, display: “flex”, flexDirection: “column”, alignItems: “center”, gap: 8 }}>
<span style={{ fontSize: 11, color: “#6b7280” }}>Carga (kg)</span>
<input type=“number” value={weight} onChange={e => setWeight(e.target.value)} placeholder=”—”
style={{ background: “none”, border: “none”, fontSize: 22, fontWeight: 700, color: “#f9fafb”, width: 60, textAlign: “center”, outline: “none” }} />
</div>
</div>
<button onClick={onConfirm} style={{ width: “100%”, background: “#a3e635”, border: “none”, borderRadius: 12, padding: 16, fontSize: 18, fontWeight: 700, color: “#0a0a0a”, cursor: “pointer” }}>
+ ADICIONAR
</button>
</>
);
}

// ── MODAL ──────────────────────────────────────────────────────────────────
function PickerModal({ onClose, onAdd }) {
const [group, setGroup] = useState(null);
// “library” | “custom”
const [mode, setMode] = useState(“library”);
const [exName, setExName] = useState(null);
const [sets, setSets] = useState(3);
const [reps, setReps] = useState(12);
const [weight, setWeight] = useState(””);
// custom fields
const [customName, setCustomName] = useState(””);
const [customUnit, setCustomUnit] = useState(“kg”);
const [customGroup, setCustomGroup] = useState(“Peito”);
const [customStep, setCustomStep] = useState(“form”); // “form” | “config”

function confirmLibrary() {
const ex = EXERCISE_LIBRARY[group].find(e => e.name === exName);
onAdd({ id: genId(), name: exName, group, sets, reps, weight: weight ? Number(weight) : null, unit: ex.unit, done: [] });
onClose();
}

function confirmCustom() {
if (!customName.trim()) return;
onAdd({ id: genId(), name: customName.trim(), group: customGroup, sets, reps, weight: weight ? Number(weight) : null, unit: customUnit, done: [] });
onClose();
}

function resetAll() {
setGroup(null); setExName(null); setSets(3); setReps(12); setWeight(””);
setMode(“library”); setCustomName(””); setCustomUnit(“kg”); setCustomGroup(“Peito”); setCustomStep(“form”);
}

const sheetTitle = mode === “custom”
? (customStep === “form” ? “Exercício personalizado” : customName || “Personalizado”)
: (!group ? “Escolha o grupo” : !exName ? `— ${group}` : group);

return (
<div style={{ position: “fixed”, inset: 0, zIndex: 100, background: “rgba(0,0,0,0.75)”, display: “flex”, alignItems: “flex-end”, justifyContent: “center” }} onClick={onClose}>
<div style={{ background: “#111827”, borderRadius: “20px 20px 0 0”, width: “100%”, maxWidth: 480, padding: “24px 20px 40px”, maxHeight: “88vh”, overflowY: “auto” }} onClick={e => e.stopPropagation()}>

```
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>{sheetTitle}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
    </div>

    {/* ── LIBRARY MODE ── */}
    {mode === "library" && !group && (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {GROUP_ORDER.map(g => (
            <button key={g} onClick={() => setGroup(g)} style={{ background: "#1f2937", border: `1.5px solid ${MUSCLE_COLORS[g]}33`, borderRadius: 12, padding: "14px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: MUSCLE_COLORS[g], display: "block" }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>{g}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{EXERCISE_LIBRARY[g].length} exercícios</span>
            </button>
          ))}
        </div>
        {/* Custom CTA */}
        <button onClick={() => { setMode("custom"); setCustomStep("form"); }} style={{ width: "100%", background: "transparent", border: "1.5px dashed #374151", borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 20, color: "#6b7280" }}>✏️</span>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#d1d5db" }}>Exercício personalizado</p>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Crie com nome e grupo próprios</p>
          </div>
        </button>
      </>
    )}

    {mode === "library" && group && !exName && (
      <>
        <button onClick={() => setGroup(null)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16 }}>← voltar</button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXERCISE_LIBRARY[group].map(ex => (
            <button key={ex.name} onClick={() => setExName(ex.name)} style={{ background: "#1f2937", border: "1.5px solid #374151", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", textAlign: "left", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "#f9fafb", fontWeight: 600, marginBottom: 3 }}>{ex.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{ex.desc}</div>
              </div>
              <span style={{ fontSize: 11, color: "#6b7280", background: "#0a0f1a", padding: "3px 8px", borderRadius: 20, flexShrink: 0, marginTop: 2 }}>{ex.unit}</span>
            </button>
          ))}

          {/* Add custom inside group */}
          <button onClick={() => { setMode("custom"); setCustomGroup(group); setCustomStep("form"); }} style={{ background: "transparent", border: "1.5px dashed #374151", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 18, color: "#6b7280" }}>✏️</span>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>Adicionar exercício em {group}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Crie um exercício com nome próprio</p>
            </div>
          </button>
        </div>
      </>
    )}

    {mode === "library" && group && exName && (
      <ConfigStep name={exName} group={group} unit={EXERCISE_LIBRARY[group]?.find(e => e.name === exName)?.unit}
        desc={EXERCISE_LIBRARY[group]?.find(e => e.name === exName)?.desc}
        sets={sets} reps={reps} weight={weight} setSets={setSets} setReps={setReps} setWeight={setWeight}
        onBack={() => setExName(null)} onConfirm={confirmLibrary} />
    )}

    {/* ── CUSTOM MODE ── */}
    {mode === "custom" && customStep === "form" && (
      <>
        <button onClick={() => setMode("library")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 20 }}>← voltar</button>

        {/* Name input */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Nome do exercício</p>
          <input
            value={customName} onChange={e => setCustomName(e.target.value)}
            placeholder="Ex: Rosca Scott, Face Pull..."
            style={{ width: "100%", background: "#1f2937", border: "1.5px solid #374151", borderRadius: 10, padding: "14px 14px", fontSize: 16, color: "#f9fafb", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Group picker */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Grupo muscular</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GROUP_ORDER.map(g => (
              <button key={g} onClick={() => setCustomGroup(g)} style={{
                background: customGroup === g ? MUSCLE_COLORS[g] + "33" : "#1f2937",
                border: `1.5px solid ${customGroup === g ? MUSCLE_COLORS[g] : "#374151"}`,
                borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                color: customGroup === g ? MUSCLE_COLORS[g] : "#9ca3af",
              }}>{g}</button>
            ))}
          </div>
        </div>

        {/* Unit picker */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Unidade</p>
          <div style={{ display: "flex", gap: 8 }}>
            {["kg", "reps", "seg"].map(u => (
              <button key={u} onClick={() => setCustomUnit(u)} style={{
                flex: 1, background: customUnit === u ? "#a3e635" : "#1f2937",
                border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer",
                fontSize: 14, fontWeight: 700,
                color: customUnit === u ? "#0a0a0a" : "#6b7280",
              }}>{u}</button>
            ))}
          </div>
        </div>

        <button
          onClick={() => { if (customName.trim()) setCustomStep("config"); }}
          style={{ width: "100%", background: customName.trim() ? "#a3e635" : "#1f2937", border: "none", borderRadius: 12, padding: 16, fontSize: 18, fontWeight: 700, color: customName.trim() ? "#0a0a0a" : "#4b5563", cursor: customName.trim() ? "pointer" : "default" }}>
          Próximo →
        </button>
      </>
    )}

    {mode === "custom" && customStep === "config" && (
      <ConfigStep name={customName} group={customGroup} unit={customUnit}
        sets={sets} reps={reps} weight={weight} setSets={setSets} setReps={setReps} setWeight={setWeight}
        onBack={() => setCustomStep("form")} onConfirm={confirmCustom} />
    )}
  </div>
</div>
```

);
}

// ── EXERCISE CARD ──────────────────────────────────────────────────────────
function ExerciseCard({ exercise, onRemove, onToggleSet, onUpdateSetWeight }) {
const color = MUSCLE_COLORS[exercise.group] || “#6b7280”;
const doneSets = exercise.done.length;
const totalSets = exercise.sets;
const fullyDone = doneSets === totalSets;

return (
<div style={{ background: “#111827”, borderRadius: 16, border: `1px solid ${fullyDone ? color + "55" : "#1f2937"}`, overflow: “hidden”, transition: “border-color 0.3s” }}>

```
  {/* Header */}
  <div style={{ padding: "14px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
        <span style={{ fontSize: 11, color, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>{exercise.group}</span>
      </div>
      <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#f9fafb" }}>{exercise.name}</p>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {doneSets > 0 && (
        <span style={{ fontSize: 12, color, fontWeight: 600 }}>{doneSets}/{totalSets}</span>
      )}
      <button onClick={() => onRemove(exercise.id)} style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: 16, padding: "2px 4px" }}>✕</button>
    </div>
  </div>

  {/* Column labels */}
  <div style={{ padding: "2px 16px 6px", display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontSize: 11, color: "#4b5563", flex: "0 0 60px" }}>Série</span>
    <span style={{ fontSize: 11, color: "#4b5563", flex: 1, textAlign: "center" }}>{exercise.reps} reps · carga ({exercise.unit})</span>
    <span style={{ fontSize: 11, color: "#4b5563", flex: "0 0 40px", textAlign: "center" }}>✓</span>
  </div>

  {/* Per-set rows */}
  <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
    {Array.from({ length: totalSets }, (_, i) => {
      const isDone = exercise.done.includes(i);
      const setWeight = exercise.setWeights?.[i] ?? (exercise.weight ?? "");
      return (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: isDone ? color + "18" : "#1a2234",
          borderRadius: 10, padding: "8px 12px",
          border: `1px solid ${isDone ? color + "44" : "#1f2937"}`,
          transition: "all 0.15s",
        }}>
          {/* Serie label */}
          <span style={{ flex: "0 0 60px", fontSize: 13, fontWeight: 600, color: isDone ? color : "#6b7280" }}>
            Série {i + 1}
          </span>

          {/* Divider line */}
          <div style={{ flex: 1, height: 1, background: isDone ? color + "33" : "#374151" }} />

          {/* Weight input */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#111827", borderRadius: 8, padding: "4px 8px", border: `1px solid ${isDone ? color + "44" : "#374151"}` }}>
            <button
              onClick={() => {
                const cur = Number(setWeight) || 0;
                onUpdateSetWeight(exercise.id, i, Math.max(0, cur - 2.5));
              }}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", display: "flex", alignItems: "center" }}>−</button>
            <input
              type="number"
              value={setWeight}
              onChange={e => onUpdateSetWeight(exercise.id, i, e.target.value)}
              placeholder="—"
              style={{ background: "none", border: "none", width: 40, textAlign: "center", fontSize: 14, fontWeight: 700, color: isDone ? color : "#f9fafb", outline: "none" }}
            />
            <button
              onClick={() => {
                const cur = Number(setWeight) || 0;
                onUpdateSetWeight(exercise.id, i, cur + 2.5);
              }}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", display: "flex", alignItems: "center" }}>+</button>
          </div>

          {/* Check button */}
          <button onClick={() => onToggleSet(exercise.id, i)} style={{
            flex: "0 0 36px", height: 36, borderRadius: 8,
            background: isDone ? color : "transparent",
            border: isDone ? "none" : "1.5px solid #374151",
            color: isDone ? "#0a0a0a" : "#4b5563",
            fontSize: isDone ? 16 : 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {isDone ? "✓" : "○"}
          </button>
        </div>
      );
    })}
  </div>
</div>
```

);
}

// ── HISTORY STORAGE ────────────────────────────────────────────────────────
const HISTORY_KEY = “gymlog_history_v1”;
function loadHistory() {
try { const s = storage.get(HISTORY_KEY); if (s) return JSON.parse(s); } catch (*) {}
return [];
}
function saveHistory(h) {
try { storage.set(HISTORY_KEY, JSON.stringify(h)); } catch (*) {}
}

// ── TIMER HOOK ─────────────────────────────────────────────────────────────
function useTimer(running) {
const [elapsed, setElapsed] = useState(0);
const startRef = useState(() => null)[0];
const ref = { start: null };
useEffect(() => {
if (!running) { setElapsed(0); return; }
const t0 = Date.now();
const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
return () => clearInterval(iv);
}, [running]);
return elapsed;
}

function fmtTime(s) {
const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

// ── HISTORY SCREEN ─────────────────────────────────────────────────────────
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from “recharts”;

function HistoryScreen({ onClose }) {
const [history] = useState(loadHistory);
const [selectedEx, setSelectedEx] = useState(null);

// Build list of all exercise names that appear in history
const allExNames = […new Set(history.flatMap(s => s.exercises.map(e => e.name)))].sort();

// Build chart data for selected exercise
const chartData = selectedEx
? history
.filter(s => s.exercises.some(e => e.name === selectedEx))
.map(s => {
const ex = s.exercises.find(e => e.name === selectedEx);
const weights = (ex.setWeights || []).map(Number).filter(w => w > 0);
const maxW = weights.length ? Math.max(…weights) : 0;
return { date: s.dateShort, max: maxW, vol: ex.done.length * ex.reps * maxW };
})
: [];

const groupColor = selectedEx
? (() => {
for (const s of history) {
const ex = s.exercises.find(e => e.name === selectedEx);
if (ex) return MUSCLE_COLORS[ex.group] || “#a3e635”;
}
return “#a3e635”;
})()
: “#a3e635”;

return (
<div style={{ position: “fixed”, inset: 0, background: “#0a0f1a”, zIndex: 200, overflowY: “auto”, maxWidth: 480, margin: “0 auto” }}>
{/* Header */}
<div style={{ padding: “20px 20px 0”, display: “flex”, justifyContent: “space-between”, alignItems: “center”, marginBottom: 20 }}>
<div>
<p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: “#a3e635”, letterSpacing: “-0.5px” }}>Traine<span style={{ color: “#f9fafb” }}>Fy</span></p>
<h1 style={{ margin: “2px 0 0”, fontSize: 28, fontWeight: 800, color: “#f9fafb” }}>Histórico</h1>
</div>
<button onClick={onClose} style={{ background: “#1f2937”, border: “none”, borderRadius: 10, padding: “8px 14px”, color: “#9ca3af”, fontSize: 14, cursor: “pointer” }}>← Voltar</button>
</div>

```
  {history.length === 0 ? (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", gap: 16 }}>
      <div style={{ fontSize: 48 }}>📊</div>
      <p style={{ fontSize: 14, color: "#4b5563", textAlign: "center", margin: 0 }}>Nenhuma sessão finalizada ainda.<br />Complete um treino para ver a evolução aqui.</p>
    </div>
  ) : (
    <div style={{ padding: "0 20px 100px" }}>

      {/* Exercise selector */}
      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>Escolha o exercício</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {allExNames.map(name => {
          const isSelected = selectedEx === name;
          const grp = (() => { for (const s of history) { const e = s.exercises.find(x => x.name === name); if (e) return e.group; } return null; })();
          const c = MUSCLE_COLORS[grp] || "#6b7280";
          return (
            <button key={name} onClick={() => setSelectedEx(isSelected ? null : name)} style={{
              background: isSelected ? c + "22" : "#1f2937",
              border: `1.5px solid ${isSelected ? c : "#374151"}`,
              borderRadius: 20, padding: "6px 12px", cursor: "pointer",
              fontSize: 12, fontWeight: isSelected ? 700 : 400,
              color: isSelected ? c : "#9ca3af",
            }}>
              {name}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {selectedEx && chartData.length > 0 && (
        <div style={{ background: "#111827", borderRadius: 16, padding: "16px 8px 8px", marginBottom: 24, border: "1px solid #1f2937" }}>
          <p style={{ margin: "0 0 4px 12px", fontSize: 11, color: groupColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{selectedEx}</p>
          <p style={{ margin: "0 0 16px 12px", fontSize: 11, color: "#4b5563" }}>Carga máxima por sessão (kg)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: `1px solid ${groupColor}44`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
                itemStyle={{ color: groupColor }}
                formatter={(v) => [`${v} kg`, "Carga máx."]}
              />
              <Line type="monotone" dataKey="max" stroke={groupColor} strokeWidth={2.5} dot={{ fill: groupColor, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
          {chartData.length === 1 && (
            <p style={{ margin: "8px 12px 0", fontSize: 11, color: "#4b5563" }}>Complete mais sessões para ver a evolução 📈</p>
          )}
        </div>
      )}

      {/* Sessions list */}
      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>Sessões ({history.length})</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...history].reverse().map((session, i) => (
          <div key={i} style={{ background: "#111827", borderRadius: 14, padding: "14px 16px", border: "1px solid #1f2937" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>{session.day}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>{session.date} · {session.duration}</p>
              </div>
              <span style={{ background: "#1f2937", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#9ca3af" }}>
                {session.exercises.length} exercícios
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {session.exercises.map((ex, j) => {
                const weights = (ex.setWeights || []).map(Number).filter(w => w > 0);
                const maxW = weights.length ? Math.max(...weights) : null;
                const c = MUSCLE_COLORS[ex.group] || "#6b7280";
                return (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#d1d5db" }}>{ex.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {ex.done.length}/{ex.sets} séries{maxW ? ` · ${maxW}kg` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

);
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function WorkoutTracker() {
const [workouts, setWorkouts] = useState(loadWorkouts);
const [activeDay, setActiveDay] = useState(0);
const [showPicker, setShowPicker] = useState(false);
const [savedFlash, setSavedFlash] = useState(false);
const [sessionActive, setSessionActive] = useState(false);
const [sessionStartTs, setSessionStartTs] = useState(null);
const [showFinishConfirm, setShowFinishConfirm] = useState(false);
const [showHistory, setShowHistory] = useState(false);
const [history, setHistory] = useState(loadHistory);

const elapsed = useTimer(sessionActive);

useEffect(() => {
try { storage.set(STORAGE_KEY, JSON.stringify(workouts)); } catch (_) {}
setSavedFlash(true);
const t = setTimeout(() => setSavedFlash(false), 1200);
return () => clearTimeout(t);
}, [workouts]);

const dayKey = WEEKDAYS[activeDay];
const exercises = workouts[dayKey] || [];
const doneCount = exercises.filter(e => e.done.length === e.sets).length;
const isRest = dayKey === “Sáb” || dayKey === “Dom”;

const volume = exercises.reduce((acc, ex) => {
return acc + ex.done.reduce((s, setIdx) => {
const w = ex.setWeights?.[setIdx] ?? ex.weight ?? 0;
return s + Number(w) * ex.reps;
}, 0);
}, 0);

function addExercise(ex) {
const setWeights = Array.from({ length: ex.sets }, () => ex.weight ?? “”);
setWorkouts(prev => ({ …prev, [dayKey]: […(prev[dayKey] || []), { …ex, setWeights }] }));
}
function removeExercise(id) {
setWorkouts(prev => ({ …prev, [dayKey]: prev[dayKey].filter(e => e.id !== id) }));
}
function toggleSet(exId, setIdx) {
setWorkouts(prev => ({
…prev,
[dayKey]: prev[dayKey].map(ex => {
if (ex.id !== exId) return ex;
const done = ex.done.includes(setIdx) ? ex.done.filter(s => s !== setIdx) : […ex.done, setIdx];
return { …ex, done };
}),
}));
}
function updateSetWeight(exId, setIdx, val) {
setWorkouts(prev => ({
…prev,
[dayKey]: prev[dayKey].map(ex => {
if (ex.id !== exId) return ex;
const setWeights = […(ex.setWeights || Array.from({ length: ex.sets }, () => ex.weight ?? “”))];
setWeights[setIdx] = val === “” ? “” : Number(val);
return { …ex, setWeights };
}),
}));
}

function startSession() {
setSessionActive(true);
setSessionStartTs(Date.now());
}

function finishSession() {
const duration = fmtTime(elapsed);
const now = new Date();
const dateShort = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}`;
const dateFull = now.toLocaleDateString(“pt-BR”, { day: “2-digit”, month: “short”, year: “numeric” });
const session = {
day: dayKey,
date: dateFull,
dateShort,
duration,
volume,
exercises: exercises.map(ex => ({ …ex })),
};
const newHistory = […history, session];
setHistory(newHistory);
saveHistory(newHistory);

```
// Reset checks but keep exercises and weights
setWorkouts(prev => ({
  ...prev,
  [dayKey]: prev[dayKey].map(ex => ({ ...ex, done: [] })),
}));

setSessionActive(false);
setSessionStartTs(null);
setShowFinishConfirm(false);
```

}

if (showHistory) return <HistoryScreen onClose={() => setShowHistory(false)} />;

return (
<div style={{ minHeight: “100vh”, background: “#0a0f1a”, fontFamily: “system-ui,sans-serif”, maxWidth: 480, margin: “0 auto”, paddingBottom: 120 }}>

```
  {/* Header */}
  <div style={{ padding: "20px 20px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#a3e635", letterSpacing: "-0.5px" }}>Traine<span style={{ color: "#f9fafb" }}>Fy</span></span>
          <span style={{ fontSize: 10, color: "#a3e635", opacity: savedFlash ? 1 : 0, transition: "opacity 0.4s" }}>✓ salvo</span>
        </div>
        <h1 style={{ margin: "2px 0 0", fontSize: 30, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>
          {isRest ? "🛌 Descanso" : `💪 ${dayKey}`}
        </h1>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {/* History button */}
        <button onClick={() => setShowHistory(true)} style={{ background: "#1f2937", border: "none", borderRadius: 8, padding: "6px 10px", color: "#9ca3af", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          📊 Histórico
        </button>
        {exercises.length > 0 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#a3e635", lineHeight: 1 }}>{doneCount}/{exercises.length}</div>
            <div style={{ fontSize: 10, color: "#4b5563" }}>exercícios</div>
          </div>
        )}
      </div>
    </div>

    {/* Volume + Timer row */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
      {volume > 0
        ? <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Volume: <strong style={{ color: "#a3e635" }}>{volume.toLocaleString("pt-BR")} kg</strong></p>
        : <span />
      }
      {sessionActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#a3e63522", borderRadius: 20, padding: "4px 12px", border: "1px solid #a3e63544" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a3e635", display: "inline-block", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#a3e635", fontVariantNumeric: "tabular-nums" }}>{fmtTime(elapsed)}</span>
        </div>
      )}
    </div>
  </div>

  {/* Day Selector */}
  <div style={{ padding: "16px 20px 8px", overflowX: "auto" }}>
    <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
      {WEEKDAYS.map((day, i) => {
        const isActive = i === activeDay;
        const hasEx = (workouts[day] || []).length > 0;
        return (
          <button key={day} onClick={() => { if (!sessionActive) setActiveDay(i); }} style={{
            position: "relative",
            background: isActive ? "#a3e635" : hasEx ? "#1f2937" : "transparent",
            border: isActive ? "none" : `1.5px solid ${hasEx ? "#374151" : "#1f2937"}`,
            borderRadius: 10, padding: "8px 14px", cursor: sessionActive ? "default" : "pointer",
            fontSize: 16, fontWeight: isActive ? 700 : 500,
            color: isActive ? "#0a0a0a" : hasEx ? "#d1d5db" : "#374151",
            opacity: sessionActive && !isActive ? 0.4 : 1,
            transition: "all 0.15s",
          }}>
            {day}
            {hasEx && !isActive && (
              <span style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: "#a3e635" }} />
            )}
          </button>
        );
      })}
    </div>
  </div>

  {/* Progress Bar */}
  {exercises.length > 0 && (
    <div style={{ margin: "0 20px 16px", height: 3, background: "#1f2937", borderRadius: 2 }}>
      <div style={{ height: "100%", borderRadius: 2, background: "#a3e635", width: `${(doneCount / exercises.length) * 100}%`, transition: "width 0.4s ease" }} />
    </div>
  )}

  {/* Exercise List */}
  <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
    {exercises.length === 0 ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏋️</div>
        <p style={{ fontSize: 14, textAlign: "center", margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
          Nenhum exercício ainda.<br />Toca em <strong style={{ color: "#a3e635" }}>+ Exercício</strong> pra começar.
        </p>
      </div>
    ) : exercises.map(ex => (
      <ExerciseCard key={ex.id} exercise={ex} onRemove={removeExercise} onToggleSet={toggleSet} onUpdateSetWeight={updateSetWeight} />
    ))}
  </div>

  {/* Bottom bar */}
  <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 40, padding: "12px 20px 28px", background: "linear-gradient(to top, #0a0f1a 70%, transparent)", display: "flex", flexDirection: "column", gap: 8 }}>

    {/* Finish confirm */}
    {showFinishConfirm && (
      <div style={{ background: "#1f2937", borderRadius: 14, padding: "14px 16px", border: "1px solid #374151", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#f9fafb", fontWeight: 600 }}>Finalizar e salvar treino?</p>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>As séries marcadas serão limpas. Os pesos ficam salvos.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowFinishConfirm(false)} style={{ flex: 1, background: "#374151", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, color: "#9ca3af", cursor: "pointer" }}>Cancelar</button>
          <button onClick={finishSession} style={{ flex: 2, background: "#a3e635", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, color: "#0a0a0a", cursor: "pointer" }}>✓ Salvar sessão</button>
        </div>
      </div>
    )}

    {/* Main action buttons */}
    {!isRest && exercises.length > 0 && (
      sessionActive ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowPicker(true)} style={{ flex: 1, background: "#1f2937", border: "1.5px solid #374151", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 600, color: "#d1d5db", cursor: "pointer" }}>
            + Exercício
          </button>
          <button onClick={() => setShowFinishConfirm(true)} style={{ flex: 2, background: "#ef4444", border: "none", borderRadius: 14, padding: 14, fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}>
            ⏹ Finalizar treino
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowPicker(true)} style={{ flex: 1, background: "#1f2937", border: "1.5px solid #374151", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 600, color: "#d1d5db", cursor: "pointer" }}>
            + Exercício
          </button>
          <button onClick={startSession} style={{ flex: 2, background: "#a3e635", border: "none", borderRadius: 14, padding: 14, fontSize: 16, fontWeight: 700, color: "#0a0a0a", cursor: "pointer", boxShadow: "0 4px 24px rgba(163,230,53,0.3)" }}>
            ▶ Iniciar treino
          </button>
        </div>
      )
    )}

    {(isRest || exercises.length === 0) && (
      <button onClick={() => setShowPicker(true)} style={{ width: "100%", background: "#a3e635", border: "none", borderRadius: 14, padding: 16, fontSize: 18, fontWeight: 700, color: "#0a0a0a", cursor: "pointer", boxShadow: "0 4px 24px rgba(163,230,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>+</span> Exercício
      </button>
    )}
  </div>

  <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
  {showPicker && <PickerModal onClose={() => setShowPicker(false)} onAdd={addExercise} />}
</div>
```

);
}
