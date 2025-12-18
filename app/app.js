(() => {
  const STORAGE_KEY = "poker_school_app_state_v1";

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return {
      isSubscribed: false,
      trial: { completedActions: 0 }, // 0..3
      sessions: [], // {id, createdAt, decisions, scoreRaw, capped, redCount, orangeCount, yellowCount, priority}
      lastSessionId: null,
    };
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(State));
    refreshTopbar();
  }

  function resetState(){
    localStorage.removeItem(STORAGE_KEY);
    State = loadState();
    render();
  }

  // -------------------------
  // Démo scoring (placeholder crédible)
  // Remplacera ton vrai moteur HH plus tard.
  // -------------------------
  function demoAnalyze(){
    // Simule un import : on génère une session "réaliste"
    const decisions = Math.floor(35 + Math.random()*35); // 35..70
    const redCount = Math.random() < 0.65 ? Math.floor(1 + Math.random()*3) : 0; // souvent au moins 1
    const orangeCount = Math.floor(2 + Math.random()*5);
    const yellowCount = Math.floor(2 + Math.random()*6);

    // score brut simulé
    let scoreRaw = Math.floor(62 + Math.random()*28); // 62..90

    // Plafond si erreur réelle (🔴)
    const capped = redCount > 0;
    const score = capped ? Math.min(scoreRaw, 80) : scoreRaw;

    // Priorité: l'erreur réelle la plus prioritaire (simple: red si présent, sinon orange)
    const priority = redCount > 0
      ? { level:"red", title:"Open hors range UTG", hint:"UTG, ≤25bb → pas d’offsuit faibles sous AT", why:"UTG est défavorable : tu joues souvent hors position contre des ranges dominantes." }
      : { level:"orange", title:"Call marginal hors position", hint:"Réduis les calls borderline OOP", why:"Hors position, tes calls borderline se transforment souvent en décisions difficiles et coûteuses." };

    return { decisions, scoreRaw: score, capped, redCount, orangeCount, yellowCount, priority };
  }

  // -------------------------
  // UX / Screens
  // -------------------------
  const app = document.getElementById("app");
  const trialBadge = document.getElementById("trialBadge");
  const trialMeta  = document.getElementById("trialMeta");
  const btnSubscribe = document.getElementById("btnSubscribe");
  const btnReset = document.getElementById("btnReset");

  let State = loadState();

  function refreshTopbar(){
    const done = clamp(State.trial.completedActions, 0, 3);

    if(State.isSubscribed){
      trialBadge.textContent = "Accès complet activé";
      trialMeta.textContent = "Toutes fonctionnalités débloquées";
      btnSubscribe.style.display = "none";
    }else{
      trialBadge.textContent = "Essai en cours";
      trialMeta.textContent = `Progression : ${done} / 3 actions`;
      btnSubscribe.style.display = "inline-flex";
    }
  }

  function html(strings, ...values){
    return strings.map((s,i)=> s + (values[i] ?? "")).join("");
  }

  function pill(level, text){
    const icon = level==="red" ? "🔴" : level==="orange" ? "🟠" : "🟡";
    return `<span class="tag">${icon} ${text}</span>`;
  }

  function render(){
    refreshTopbar();

    // Fin essai (3 actions) et pas abonné => page dédiée
    if(!State.isSubscribed && State.trial.completedActions >= 3){
      app.innerHTML = renderPaywall();
      wirePaywall();
      return;
    }

    // Si pas de session => écran Session 1 (import)
    if(State.sessions.length === 0){
      app.innerHTML = renderWelcome();
      wireWelcome();
      return;
    }

    // Sinon dernière session => résultats + validation
    const s = State.sessions.find(x => x.id === State.lastSessionId) || State.sessions[State.sessions.length - 1];
    app.innerHTML = renderResults(s);
    wireResults(s);
  }

  function renderWelcome(){
    return html`
      <div class="stack">
        <div class="card">
          <div class="h1">Analyse ton jeu. Pas ton ego.</div>
          <p class="p">Importe un tournoi. L’outil mesure si tu respectes la méthode et pointe ce qui te coûte vraiment.</p>
          <div class="hr"></div>

          <button class="btn primary" id="btnImport">Importer un tournoi</button>
          <p class="small" style="margin-top:10px;">Formats : Winamax MTT (placeholder pour l’instant) • Analyse ~10s</p>

          <div class="hr"></div>
          <div class="h2">Tu obtiendras :</div>
          <ul class="list">
            <li>Un score global de respect de la méthode</li>
            <li>Tes erreurs les plus coûteuses (priorisées)</li>
            <li>Une règle simple à appliquer immédiatement</li>
          </ul>

          <p class="small" style="margin-top:12px;">Aucun jugement. Juste des règles claires, mesurables, répétables.</p>
        </div>
      </div>
    `;
  }

  function wireWelcome(){
    document.getElementById("btnImport").onclick = () => {
      const analysis = demoAnalyze();
      const session = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        reviewed: false,
        ...analysis
      };
      State.sessions.push(session);
      State.lastSessionId = session.id;

      // Action d’essai #1 = un diagnostic (première fois seulement)
      if(State.trial.completedActions < 1 && !State.isSubscribed){
        State.trial.completedActions = 1;
      }

      saveState();
      render();
    };
  }

  function renderResults(s){
    const done = clamp(State.trial.completedActions, 0, 3);
    const scoreLine = s.capped
      ? `<div class="kpi">Score : ${s.scoreRaw}% (plafonné à 80%)</div><div class="small">⚠️ Une ou plusieurs décisions violent une règle fondamentale.</div>`
      : `<div class="kpi">Score : ${s.scoreRaw}%</div>`;

    const sampleRed = `
      <li>Open hors range UTG (x${Math.max(1, s.redCount)})</li>
      ${s.redCount > 1 ? `<li>Call all-in short stack hors range (x${Math.max(1, s.redCount-1)})</li>` : ``}
    `;

    const improvementsLocked = !State.isSubscribed ? `
      <div class="lock">
        <div class="small"><b>🔒 Fonctionnalité abonnement</b> — axes d’amélioration exploitables + plan de progression</div>
        <div class="blur small" style="margin-top:8px;">
          Plan : réduire la fréquence, exemples, mains typiques, erreurs associées, drill 7 jours…
        </div>
        <div style="margin-top:10px;">
          <button class="btn" id="btnGoSubscribeFromAxes" type="button">Débloquer</button>
        </div>
      </div>
    ` : `
      <div class="block">
        <div class="small"><b>Plan de progression</b> (abonné)</div>
        <ul class="list" style="margin-top:8px;">
          <li>Réduire les calls OOP borderline</li>
          <li>Contrôler les opens UTG à 25bb</li>
          <li>Stop auto c-bet en multiway</li>
        </ul>
      </div>
    `;

    const explainLocked = !State.isSubscribed ? `
      <div class="lock">
        <div class="small"><b>🔒 Analyse complète</b> — “pourquoi” + “comment” détaillés</div>
        <div class="blur small" style="margin-top:8px;">
          Pourquoi UTG est structurellement défavorable, comment construire la range, quelles exceptions, exemples concrets…
        </div>
        <div style="margin-top:10px;">
          <button class="btn" id="btnGoSubscribeFromExplain" type="button">Débloquer l’analyse complète</button>
        </div>
      </div>
    ` : `
      <div class="block">
        <div class="small"><b>Analyse complète</b> (abonné)</div>
        <p class="small" style="margin:8px 0 0;">
          UTG joue souvent hors position contre des ranges dominantes. Une range trop large crée des spots EV-.
          On garde une range stricte ≤25bb et on simplifie les branches postflop.
        </p>
      </div>
    `;

    return html`
      <div class="stack">
        <div class="card">
          <div class="row" style="align-items:flex-start;">
            <div>
              <div class="h1" style="margin-bottom:6px;">Résultat</div>
              <div class="muted">Basé sur <b>${s.decisions}</b> décisions clés</div>
            </div>
            <div class="kpiRow">
              ${scoreLine}
              <div class="kpi">Essai : ${done}/3</div>
            </div>
          </div>

          <div class="hr"></div>

          <div class="grid2">
            <div class="block">
              <div class="h2">Diagnostic</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                ${pill("red", `Erreurs réelles (${s.redCount})`)}
                ${pill("orange", `Axes d’amélioration (${s.orangeCount})`)}
                ${pill("yellow", `Axes de perfectionnement (${s.yellowCount})`)}
              </div>

              <div class="small"><b>🔴 Erreurs réelles</b> (celles qui coûtent vraiment)</div>
              <ul class="list" style="margin-top:6px;">
                ${s.redCount > 0 ? sampleRed : `<li>Aucune erreur réelle détectée ✅</li>`}
              </ul>

              <div class="hr"></div>

              <div class="small"><b>🟠 Axes d’amélioration</b> (EV- modéré)</div>
              <ul class="list" style="margin-top:6px;">
                <li>Call marginal hors position</li>
                <li>Open ATo UTG trop fréquent</li>
                <li>C-bet automatique en multiway</li>
              </ul>

              <div class="hr"></div>

              <div class="small"><b>🟡 Axes de perfectionnement</b> (optimisations fines)</div>
              <ul class="list" style="margin-top:6px;">
                <li>Sizings plus cohérents</li>
                <li>Sélection de bluffs river</li>
                <li>Gestion multiway</li>
              </ul>
            </div>

            <div class="stack">
              <div class="block">
                <div class="h2">Priorité actuelle</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                  ${pill(s.priority.level, s.priority.title)}
                </div>
                <div class="small"><b>Règle immédiate</b></div>
                <div style="margin-top:6px; font-weight:900;">${s.priority.hint}</div>

                <div class="hr"></div>

                <div class="small"><b>Pourquoi (résumé)</b></div>
                <p class="small" style="margin:6px 0 0;">${s.priority.why}</p>

                <div class="hr"></div>

                ${explainLocked}
              </div>

              ${improvementsLocked}

              <div class="block">
                <div class="h2">Review</div>
                <p class="small" style="margin:0;">Marque cette session comme reviewée pour valider l’action suivante.</p>
                <div class="hr"></div>
                <button class="btn primary" id="btnReview" type="button" ${s.reviewed ? "disabled" : ""}>
                  ${s.reviewed ? "Session déjà reviewée" : "Marquer cette session comme reviewée"}
                </button>
                <div class="small" id="reviewMsg" style="margin-top:10px;"></div>
              </div>

              <div class="block">
                <button class="btn" id="btnImportAgain" type="button">Importer une nouvelle session</button>
                <p class="small" style="margin-top:8px;">La progression est basée sur tes sessions, pas sur des “jours”.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function wireResults(s){
    const btnReview = document.getElementById("btnReview");
    const reviewMsg = document.getElementById("reviewMsg");

    if(btnReview){
      btnReview.onclick = () => {
        if(s.reviewed) return;
        s.reviewed = true;

        // Action essai #2 = review validée (si pas abonné)
        if(!State.isSubscribed && State.trial.completedActions < 2){
          State.trial.completedActions = 2;
        }

        saveState();
        reviewMsg.textContent = "✔ Session reviewée. Tu regardes tes décisions, pas tes résultats.";
        render(); // re-render pour désactiver le bouton
      };
    }

    document.getElementById("btnImportAgain").onclick = () => {
      const analysis = demoAnalyze();
      const session = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        reviewed: false,
        ...analysis
      };
      State.sessions.push(session);
      State.lastSessionId = session.id;

      // Action essai #3 = constat (nouvelle session après review)
      // Simple: si l’utilisateur a déjà 2 actions et importe encore -> 3
      if(!State.isSubscribed && State.trial.completedActions >= 2){
        State.trial.completedActions = 3;
      }

      saveState();
      render();
    };

    const goSub1 = document.getElementById("btnGoSubscribeFromExplain");
    const goSub2 = document.getElementById("btnGoSubscribeFromAxes");
    if(goSub1) goSub1.onclick = () => openSubscribe();
    if(goSub2) goSub2.onclick = () => openSubscribe();
  }

  function renderPaywall(){
    return html`
      <div class="stack">
        <div class="card">
          <div class="h1">Tu as vu l’outil à l’œuvre.</div>
          <p class="p">Diagnostic → priorité → review. Maintenant, soit tu continues ce travail, soit tu retombes dans l’automatique.</p>

          <div class="hr"></div>

          <div class="grid2">
            <div class="block">
              <div class="h2">Ce que tu as déjà obtenu</div>
              <ul class="list">
                <li>Un diagnostic clair et priorisé</li>
                <li>Une règle immédiate pour stopper les erreurs graves</li>
                <li>Un rituel de review simple</li>
              </ul>
            </div>

            <div class="block">
              <div class="h2">Avec l’abonnement</div>
              <ul class="list">
                <li>Analyse complète (pourquoi + comment)</li>
                <li>Axes 🟠 / 🟡 exploitables + plan de progression</li>
                <li>Historique et suivi de progrès</li>
              </ul>
            </div>
          </div>

          <div class="hr"></div>

          <div class="block" style="text-align:center;">
            <div class="kpi" style="display:inline-flex;">39€ / mois</div>
            <p class="small" style="margin:10px 0 0;">Annulable à tout moment. Pas d’engagement.</p>
            <div style="margin-top:12px;">
              <button class="btn primary" id="btnSubscribeNow" type="button" style="width: min(520px, 100%);">
                Débloquer l’accès complet
              </button>
            </div>
          </div>

          <div class="small" style="margin-top:12px;">
            Tu peux aussi rester en essai, mais les fonctionnalités avancées restent verrouillées.
          </div>
        </div>
      </div>
    `;
  }

  function wirePaywall(){
    document.getElementById("btnSubscribeNow").onclick = () => openSubscribe();
  }

  function openSubscribe(){
    // Mock : on active l’abonnement
    State.isSubscribed = true;
    saveState();
    render();
  }

  // Topbar actions
  btnSubscribe.onclick = () => openSubscribe();
  btnReset.onclick = () => resetState();

  // Init
  refreshTopbar();
  render();
})();
