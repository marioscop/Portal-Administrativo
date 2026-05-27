# Portal-Administrativo

# POP (Procedimento Operacional Padrão) — Portal Administrativo

## 1) Objetivo
Padronizar o uso do Portal Administrativo, com foco no módulo **Recuperação de Crédito** (Conciliação Recurso x Relatório SISBR), descrevendo **tela por tela**, suas funções e o passo a passo operacional.

## 2) Público-alvo
Usuário final do Portal Administrativo (áreas operacionais e administrativas) com acesso ao módulo.

## 3) Descrição do Sistema
O **Portal Administrativo** é um ambiente web interno para apoiar rotinas operacionais. No escopo deste POP, o foco é o módulo **Recuperação de Crédito**, responsável por apoiar o processo de **conciliação** entre bases importadas e relatórios.

**Visão geral do módulo (Recuperação de Crédito)**
- **Importação de dados**: permite importar arquivos (via SharePoint) para alimentar o banco interno (SQLite) utilizado pelo módulo.
- **Conciliação**: cruza os dados de **Recurso** com o **Relatório SISBR** para identificar registros conciliados e divergências.
- **Tratamento de divergências**: registra ações/ocorrências (incluindo desfazer quando permitido), garantindo rastreabilidade.
- **Fechamento e envio**: possibilita fechar/reabrir conciliação e registrar/envio de informações para contabilidade (quando aplicável).
- **Relatórios e evidências**: exportações em **PDF/XLSX** e trilha de auditoria para consulta posterior.

## 4) Pré-requisitos
- Acesso ao Portal Administrativo.
- Conta Microsoft 365 corporativa.
- Permissão no módulo (perfil **Usuário** ou **Admin**).

## Capítulo 1. Arquitetura do Sistema
**Visão em camadas**
- **Frontend (Web)**: aplicação SPA em React + TypeScript (Vite), responsável pela navegação, filtros, telas operacionais e exportações via API.
- **Backend (API)**: serviço NestJS responsável por importações, conciliação, auditoria e geração de arquivos (PDF/XLSX) quando aplicável.
- **Persistência local**: base **SQLite** usada pelo módulo para armazenar dados importados, trilhas de ações, fechamentos e outbox.

**Integrações e fluxos**
- **Autenticação**: login via Microsoft 365 (MSAL) e validação de autorização do usuário no módulo.
- **Importação**: leitura de arquivos/pastas do SharePoint (configurada em Automação) para alimentar a base SQLite.
- **Operação**: conciliação e tratamento de divergências registram ocorrências para rastreabilidade.
- **Relatórios/Evidências**: exportações em PDF/XLSX e consulta de trilha na Auditoria Sistêmica.

## 5) Como inserir os prints (capturas de tela)
Este POP prevê um print por tela (ou por seção principal). Para finalizar a documentação:
1. Abra a tela no sistema.
2. Faça a captura pelo Windows (Ferramenta de Captura / Win+Shift+S).
3. Salve o arquivo (PNG) e substitua os links abaixo.

Padrão sugerido de arquivos (exemplo):
- `docs/pop/01-portal.png`
- `docs/pop/02-login.png`
- `docs/pop/03-home.png`
- `docs/pop/04-dashboard.png`
- `docs/pop/05-conciliacao-extratos.png`
- `docs/pop/06-relatorios-conciliacao.png`
- `docs/pop/07-auditoria.png`
- `docs/pop/08-config-automacao.png`
- `docs/pop/09-config-acessos.png`

## 6) Telas e funções

### 6.1) Portal Administrativo — Página Inicial
**Finalidade**
- Exibir os módulos disponíveis no Portal e permitir o acesso ao módulo desejado.

**Como usar**
1. Acesse a página inicial do Portal Administrativo.
2. Clique no card do módulo **Recuperação de Crédito**.

**Print**
![Portal Administrativo — Página Inicial](docs/pop/01-portal.png)

---

### 6.2) Autenticação Microsoft (Login) / Acesso Restrito
**Finalidade**
- Autenticar o usuário com conta Microsoft 365 e validar permissão de acesso ao módulo.

**Como usar**
1. Clique em **Acessar com seu Login**.
2. Conclua a autenticação no Microsoft 365.
3. Se aparecer **Acesso Restrito**, solicite liberação à equipe responsável pelo módulo.

**Observações**
- O botão **Sair** encerra a sessão.
- O botão **Voltar ao Portal** retorna para a página inicial.

**Print**
![Login Microsoft / Acesso Restrito](docs/pop/02-login.png)

---

### 6.3) Recuperação de Crédito — Home
**Finalidade**
- Central operacional para seleção do contexto (Competência e Órgão), visão rápida de **indicadores** e **pendências prioritárias**.

**Principais recursos**
- **Buscar**: pesquisa rápida por contrato/CPF/cooperado/produto (quando aplicável).
- **Competência**: seleciona o mês/ano base.
- **Órgão**: seleciona o órgão do contexto de conciliação.
- **Somente divergências**: filtra para mostrar apenas pendências.
- **Abrir conciliação**: navega para a tela de Conciliação (Extratos).
- **Exportar XLSX**: exporta a conciliação do contexto atual para Excel.
- **Última atualização**: indica a última atualização real da conciliação do contexto.
- **Indicadores**: cards com métricas resumidas (totais, conciliados, pendências etc.).
- **Pendências prioritárias**: lista do que precisa de ação.

**Como usar (passo a passo)**
1. Selecione a **Competência**.
2. Selecione o **Órgão**.
3. (Opcional) Marque **Somente divergências**.
4. Clique em **Abrir conciliação** para tratar pendências.
5. (Opcional) Clique em **Exportar XLSX** para gerar relatório.

**Print**
![Recuperação de Crédito — Home](docs/pop/03-home.png)

---

### 6.4) Recuperação de Crédito — Dashboard
**Finalidade**
- Exibir visão gerencial/operacional com **status da conciliação**, gráficos e atalhos para ações.

**Principais recursos**
- **Contexto**: seleção de Competência/Órgão e filtro de divergências.
- **Status da Conciliação**: visão rápida do que está conciliado x pendente (Recurso e Relatório SISBR).
- **Indicadores e gráficos**: visão consolidada para acompanhamento.
- **Abrir conciliação**: navega para execução/tratamento operacional.
- **Exportar XLSX**: exportação da conciliação do contexto.

**Como usar**
1. Selecione **Competência** e **Órgão**.
2. Analise os indicadores e gráficos.
3. Se necessário, clique em **Abrir conciliação** para atuar nas pendências.

**Print**
![Recuperação de Crédito — Dashboard](docs/pop/04-dashboard.png)

---

### 6.5) Conciliação • Extratos (Recurso x Relatório SISBR)
**Finalidade**
- Tela operacional para **fechar/reabrir conciliação**, tratar pendências, incluir tarifa e gerar evidências quando aplicável.

**Principais recursos**
- **Fechar conciliação**: encerra o ciclo da competência/órgão (bloqueia alterações operacionais).
- **Reabrir conciliação** (quando disponível): reabre para ajustes.
- **Reenviar para Contabilidade** (quando fechado): reenvia o fechamento para contabilidade, com evidência.
- **Incluir tarifa**: registra tarifa (quando aplicável ao processo).
- **Tratamento de pendências**: ações para ajustar divergências do Relatório SISBR (conforme regras do módulo).

**Como usar (fluxo típico)**
1. Selecione **Competência** e **Órgão**.
2. Revise pendências e realize as ações necessárias.
3. Quando tudo estiver consistente, execute **Fechar conciliação**.
4. Se necessário, use **Reenviar para Contabilidade**.

**Print**
![Conciliação — Extratos (Recurso x Relatório SISBR)](docs/pop/05-conciliacao-extratos.png)

---

### 6.6) Relatórios → Conciliação
**Finalidade**
- Listar a conciliação no formato de relatório e permitir exportações.

**Principais recursos**
- Filtros de **Competência** e **Órgão**.
- **Somente divergências** para focar nas pendências.
- **Exportar PDF**: gera relatório em PDF.
- **Exportar XLSX**: gera relatório em Excel.
- **Lista da conciliação**: tabela com as linhas do Recurso e do Relatório SISBR.

**Como usar**
1. Selecione **Competência** e **Órgão**.
2. (Opcional) Marque **Somente divergências**.
3. Use **Exportar PDF** ou **Exportar XLSX** conforme necessidade.

**Print**
![Relatórios — Conciliação](docs/pop/06-relatorios-conciliacao.png)

---

### 6.7) Relatórios → Auditoria Sistêmica
**Finalidade**
- Consultar trilha sistêmica (eventos) para auditoria e rastreabilidade do processo.

**Tipos de eventos (Tipo)**
- **Ocorrências**: ações e desfazimentos relacionados a tratamento de divergências.
- **Tarifas**: registros/alterações de tarifas da conciliação.
- **Fechamentos**: fechar/reabrir conciliação e envio para contabilidade.
- **Contabilidade**: eventos de outbox/registro de envio (quando aplicável).

**Filtros disponíveis**
- **Competência**
- **Órgão**
- **Tipo**

**Como usar**
1. Ajuste filtros para refinar a busca.
2. Use **Anterior/Próxima** para navegar pelos registros.
3. Para investigação, utilize Data/Hora, Ação, Usuário e Detalhe.

**Print**
![Relatórios — Auditoria Sistêmica](docs/pop/07-auditoria.png)

---

### 6.8) Configurações → Automação
**Finalidade**
- Configurar parâmetros de automação e executar importações.

**Principais recursos**
- Configuração de **SharePoint** (pasta/arquivo).
- Seleção do **tipo de importação** (ex.: extratos/relatório/recurso, conforme disponível).
- Execução de **Importar agora**.
- Configuração de **notificações** (e-mails) e demais parâmetros do módulo (quando exibidos).

**Como usar**
1. Informe a URL do SharePoint.
2. Selecione o alvo de importação (quando disponível).
3. Clique para executar a importação.
4. Verifique a mensagem de retorno (sucesso/erro e totais).

**Print**
![Configurações — Automação](docs/pop/08-config-automacao.png)

---

### 6.9) Configurações → Acessos
**Finalidade**
- Gerenciar e-mails com permissão no módulo e seus perfis (**Usuário** / **Admin**).

**Como usar**
1. Informe o e-mail.
2. Selecione o perfil.
3. Clique em **Adicionar**.
4. Para remover, use o botão de remover na linha do e-mail (quando habilitado).

**Print**
![Configurações — Acessos](docs/pop/09-config-acessos.png)
