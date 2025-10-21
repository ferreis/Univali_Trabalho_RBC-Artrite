// SIMILARIDADE ORDINAL
const MAPA_ORDENADO = {
  // Escala de Gravidade (para TCSE, IL, ER)
  não: 0,
  ausente: 0,
  leve: 1,
  moderado: 2,
  importante: 3,
  "muito importante": 4,

  // Escala de Mobilidade (para Mob)
  normal: 0,
  limitado: 1,
};

const ATRIBUTOS_ORDINAIS = ["TCSE", "IL", "ER", "Mob"];
const MAX_GRAVIDADE = 4; // Máximo para TCSE, IL, ER
const MAX_MOB = 1; // Máximo para Mob

const API_URL = "http://localhost:3001";

let baseDeCasos = [];
const cabecalhos = [
  "Caso",
  "DL",
  "RC",
  "DC",
  "Mob",
  "DTS",
  "IL",
  "ER",
  "TCSE",
  "ART",
  "RM",
  "Bur",
  "Tof",
  "Sin",
  "ATG",
  "NR",
  "HLA-B27",
  "DJ",
  "Diagnostico",
];
const atributos = cabecalhos.slice(1, -1);
let opcoesAtributos = {};

let ultimoCasoDiagnosticado = null;

/**
 * Função principal que carrega os dados do servidor.
 * Chamada tanto no início quanto antes de cada diagnóstico para garantir
 * que a base de casos esteja sempre atualizada.
 */
async function carregarDadosEIniciar() {
  try {
    const resposta = await fetch(`${API_URL}/dados`);
    if (!resposta.ok) {
      throw new Error(`Erro na rede: ${resposta.statusText}`);
    }
    const textoDoArquivo = await resposta.text();

    baseDeCasos = textoDoArquivo
      .trim()
      .split("\n")
      .map((linha) => {
        const valores = linha.split(";");
        const caso = {};
        cabecalhos.forEach((cabecalho, i) => {
          caso[cabecalho] = valores[i] || "";
        });
        return caso;
      });

    if (Object.keys(opcoesAtributos).length === 0) {
      atributos.forEach((attr) => {
        if (attr !== "HLA-B27") {
          const valoresUnicos = [...new Set(baseDeCasos.map((c) => c[attr]))];
          opcoesAtributos[attr] = valoresUnicos.filter((v) => v);
        }
      });
      gerarFormularios();
    }
  } catch (erro) {
    console.error("Erro ao carregar dados do servidor:", erro);
    alert(
      "Não foi possível carregar a base de dados. Verifique se o servidor local (server.js) está rodando no terminal."
    );
  }
}

/**
 * Gera dinamicamente os campos de formulário para o novo caso e os pesos.
 */
function gerarFormularios() {
  const novoCasoForm = document.getElementById("novo-caso-form");
  const pesosForm = document.getElementById("pesos-form");

  novoCasoForm.innerHTML = "";
  pesosForm.innerHTML = "";

  atributos.forEach((attr) => {
    // Formulário para o novo caso (sem alterações aqui)
    const itemNovoCaso = document.createElement("div");
    itemNovoCaso.className = "grid-item";
    const labelNovoCaso = document.createElement("label");
    labelNovoCaso.setAttribute("for", `novo-${attr}`);
    labelNovoCaso.textContent = attr;
    itemNovoCaso.appendChild(labelNovoCaso);

    if (attr === "HLA-B27") {
      const input = document.createElement("input");
      input.type = "number";
      input.id = `novo-${attr}`;
      input.step = "0.1";
      input.value = "0.5";
      itemNovoCaso.appendChild(input);
    } else {
      const select = document.createElement("select");
      select.id = `novo-${attr}`;
      opcoesAtributos[attr].forEach((opcao) => {
        const option = document.createElement("option");
        option.value = opcao;
        option.textContent = opcao;
        select.appendChild(option);
      });
      itemNovoCaso.appendChild(select);
    }
    novoCasoForm.appendChild(itemNovoCaso);

    // Formulário para os pesos
    const itemPeso = document.createElement("div");
    itemPeso.className = "grid-item";
    const labelPeso = document.createElement("label");
    labelPeso.setAttribute("for", `peso-${attr}`);
    labelPeso.textContent = `Peso ${attr}`;
    itemPeso.appendChild(labelPeso);

    const inputPeso = document.createElement("input");
    inputPeso.type = "number";
    inputPeso.id = `peso-${attr}`;
    inputPeso.value = "1";
    inputPeso.min = "0";
    inputPeso.max = "1";
    inputPeso.step = "0.1";

    itemPeso.appendChild(inputPeso);
    pesosForm.appendChild(itemPeso);
  });
}

/**
 * Função principal que executa o diagnóstico.
 */
async function diagnosticar() {
  await carregarDadosEIniciar();

  if (baseDeCasos.length === 0) return;

  // Coleta os dados dos formulários
  const novoCaso = {};
  const pesos = {};
  atributos.forEach((attr) => {
    novoCaso[attr] = document.getElementById(`novo-${attr}`).value;
    pesos[attr] = document.getElementById(`peso-${attr}`).value;
  });

  ultimoCasoDiagnosticado = novoCaso;

  // Calcula a similaridade e ordena os resultados
  const resultados = baseDeCasos.map((caso) => ({
    ...caso,
    similaridade: calcularSimilaridade(novoCaso, caso, pesos),
  }));
  resultados.sort((a, b) => b.similaridade - a.similaridade);

  // Exibe os resultados na tabela
  const corpoTabela = document.querySelector("#tabela-resultados tbody");
  corpoTabela.innerHTML = "";
  resultados.forEach((res) => {
    const linha = corpoTabela.insertRow();
    cabecalhos.forEach((cabecalho) => {
      const celula = linha.insertCell();
      celula.textContent = res[cabecalho];
    });
    const celulaSimilaridade = linha.insertCell();
    celulaSimilaridade.textContent = (res.similaridade * 100).toFixed(2) + "%";
  });

  setTimeout(() => {
    if (
      confirm(
        "Consulta finalizada. Deseja inserir este novo caso na base de dados?"
      )
    ) {
      const diagnosticoSugerido =
        resultados.length > 0 ? resultados[0].Diagnostico : "Indefinido";
      adicionarNovoCasoNaBase(ultimoCasoDiagnosticado, diagnosticoSugerido);
    }
  }, 100);
}

/**
 * Envia o novo caso para o servidor, que o salvará no arquivo dados.txt.
 */
async function adicionarNovoCasoNaBase(dadosNovoCaso, diagnostico) {
  const proximoId =
    Math.max(0, ...baseDeCasos.map((c) => parseInt(c.Caso, 10))) + 1;

  const casoParaAdicionar = {
    Caso: proximoId.toString(),
    ...dadosNovoCaso,
    Diagnostico: diagnostico,
  };

  const novaLinha = cabecalhos
    .map((chave) => casoParaAdicionar[chave])
    .join(";");

  try {
    // Envia a nova linha para o servidor salvar no arquivo
    const resposta = await fetch(`${API_URL}/adicionar-caso`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: novaLinha,
    });

    const resultado = await resposta.json();
    alert(resultado.message);
  } catch (error) {
    console.error("Erro ao enviar novo caso para o servidor:", error);
    alert("Falha na comunicação com o servidor. O caso não foi salvo.");
  }
}

/**
 * Limpa a tabela de resultados e reseta os formulários.
 */
function limpar() {
  document.querySelector("#tabela-resultados tbody").innerHTML = "";
  ultimoCasoDiagnosticado = null;
  gerarFormularios();
}

// Funções de Cálculo
function similaridadeLocal(valorNovo, valorBase, atributo) {
  // Caso Numérico (HLA-B27)
  if (atributo === "HLA-B27") {
    const vNovo = parseFloat(String(valorNovo).replace(",", "."));
    const vBase = parseFloat(String(valorBase).replace(",", "."));
    const max = 1;
    const min = 0;
    if (isNaN(vNovo) || isNaN(vBase)) return 0;
    if (max === min) return 1;
    return 1 - Math.abs(vNovo - vBase) / (max - min);

    //Caso Ordinal (TCSE, IL, ER, Mob)
  } else if (ATRIBUTOS_ORDINAIS.includes(atributo)) {
    // Tenta obter o valor numérico do mapa. Usa 0 se não encontrar
    const vNovoNum =
      MAPA_ORDENADO[valorNovo] === undefined ? 0 : MAPA_ORDENADO[valorNovo];
    const vBaseNum =
      MAPA_ORDENADO[valorBase] === undefined ? 0 : MAPA_ORDENADO[valorBase];

    let V_MAX = 0;
    // Define o V_MAX correto para normalização
    if (atributo === "Mob") {
      V_MAX = MAX_MOB; // 1
    } else {
      V_MAX = MAX_GRAVIDADE; // 4 (para TCSE, IL, ER)
    }

    const V_MIN = 0;

    if (V_MAX === V_MIN) return 1;

    // Fórmula da Similaridade Ordinal (Distância Normalizada)
    return 1 - Math.abs(vNovoNum - vBaseNum) / (V_MAX - V_MIN);

    // Caso Simbólico/Nominal (Todos os outros)
  } else {
    return valorNovo === valorBase ? 1 : 0;
  }
}

function calcularSimilaridade(novoCaso, caso, pesos) {
  let somaPonderadaSimilaridades = 0;
  let somaPesos = 0;

  atributos.forEach((attr) => {
    const peso = parseFloat(pesos[attr]);
    if (peso > 0) {
      const similaridade = similaridadeLocal(novoCaso[attr], caso[attr], attr);
      somaPonderadaSimilaridades += similaridade * peso;
      somaPesos += peso;
    }
  });

  return somaPesos === 0 ? 0 : somaPonderadaSimilaridades / somaPesos;
}
window.onload = carregarDadosEIniciar;
