function catalogue() {
  return {
    systems: [],
    activeSystem: null,
    activeVersionFile: null,

    categoryOrder: [],
    tagColors: {},
    coreSettings: [],
    systemSettings: [],
    modules: [],

    activeCategory: 'all',
    activeTags: [],
    loadError: null,

    async init() {
      try {
        const res = await fetch('manifest.json');
        if (!res.ok) throw new Error(`manifest.json returned ${res.status}`);
        const manifest = await res.json();
        this.systems = manifest.systems || [];

        if (this.systems.length) {
          this.activeSystem = this.systems[0].id;
          const versions = this.systems[0].versions || [];
          if (versions.length) this.activeVersionFile = versions[0].file;
        }

        if (this.activeVersionFile) await this.loadVersionData();
      } catch (err) {
        console.error('Failed to load manifest.json:', err);
        this.loadError =
          'Could not load manifest.json. If you opened this file directly ' +
          '(file://...), serve it from a local server instead, e.g. ' +
          '"python3 -m http.server" run from this folder.';
      }
    },

    async selectSystem(systemId) {
      this.activeSystem = systemId;
      const sys = this.systems.find(s => s.id === systemId);
      const versions = sys ? sys.versions || [] : [];
      this.activeVersionFile = versions.length ? versions[0].file : null;
      this.activeCategory = 'all';
      this.activeTags = [];
      if (this.activeVersionFile) await this.loadVersionData();
    },

    async selectVersion(file) {
      this.activeVersionFile = file;
      this.activeCategory = 'all';
      this.activeTags = [];
      await this.loadVersionData();
    },

    async loadVersionData() {
      try {
        const res = await fetch(this.activeVersionFile);
        if (!res.ok) {
          throw new Error(`${this.activeVersionFile} returned ${res.status}`);
        }
        const data = await res.json();

        this.categoryOrder = data.categoryOrder || [];
        this.tagColors = data.tagColors || {};
        this.coreSettings = data.coreSettings || [];
        this.systemSettings = data.systemSettings || [];
        this.modules = data.modules || [];
        this.loadError = null;
      } catch (err) {
        console.error('Failed to load version data:', err);
        this.loadError = `Could not load ${this.activeVersionFile}.`;
      }
    },

    get activeSystemObj() {
      return this.systems.find(s => s.id === this.activeSystem);
    },

    get activeSystemLabel() {
      return this.activeSystemObj ? this.activeSystemObj.label : '';
    },

    get versionsForActiveSystem() {
      return this.activeSystemObj ? this.activeSystemObj.versions || [] : [];
    },

    modSettings(mod) {
      return mod.settings || [];
    },

    // Categories present among the current version's modules, ordered per
    // categoryOrder with any leftovers appended alphabetically.
    get categoriesForSystem() {
      const present = new Set(this.modules.map(m => m.category));
      const known = this.categoryOrder.filter(c => present.has(c));
      const leftover = [...present].filter(c => !this.categoryOrder.includes(c)).sort();
      return [...known, ...leftover];
    },

    get categoryModules() {
      if (this.activeCategory === 'all') return this.modules;
      return this.modules.filter(m => m.category === this.activeCategory);
    },

    get allTags() {
      const tags = new Set();
      this.categoryModules.forEach(m => m.tags.forEach(t => tags.add(t)));
      return [...tags].sort();
    },

    get filteredModules() {
      if (this.activeTags.length === 0) return this.categoryModules;
      return this.categoryModules.filter(m =>
        m.tags.some(t => this.activeTags.includes(t))
      );
    },

    get groupedModules() {
      const groups = {};
      this.filteredModules.forEach(m => {
        if (!groups[m.category]) groups[m.category] = [];
        groups[m.category].push(m);
      });

      const knownOrder = this.categoryOrder.filter(cat => groups[cat]);
      const leftover = Object.keys(groups)
        .filter(cat => !this.categoryOrder.includes(cat))
        .sort();
      const order = [...knownOrder, ...leftover];

      return order.map(cat => ({
        category: cat,
        modules: groups[cat].slice().sort((a, b) => a.name.localeCompare(b.name))
      }));
    },

    toggleTag(tag) {
      this.activeTags = this.activeTags.includes(tag)
        ? this.activeTags.filter(t => t !== tag)
        : [...this.activeTags, tag];
    },

    // Manual colors from tagColors take priority; unassigned tags fall back
    // to a deterministic auto-generated hue so nothing renders unstyled.
    tagColor(tag) {
      if (this.tagColors[tag]) return this.tagColors[tag];
      let hash = 0;
      for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 60%, 40%)`;
    }
  };
}
