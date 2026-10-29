const API = "https://www.themealdb.com/api/json/v1/1";
const $ = (s) => document.querySelector(s);
const el = {
  form: $("#searchForm"), input: $("#searchInput"), categories: $("#categoryList"),
  grid: $("#recipeGrid"), status: $("#statusMessage"), title: $("#resultsTitle"),
  eyebrow: $("#resultsEyebrow"), home: $("#navHome"), favorites: $("#navFavorites"),
  random: $("#navRandom"), count: $("#favoriteCount"), homeLink: $("#homeLink"),
  footerHome: $("#footerHome"), footerFavorites: $("#footerFavorites"),
  footerRandom: $("#footerRandom"), dialog: $("#recipeDialog"),
  dialogContent: $("#dialogContent"), close: $("#dialogClose"), toast: $("#toast")
};
let recipes = [];
let favorites = JSON.parse(localStorage.getItem("recetarioFavoritos") || "[]");
let mode = "home";
let toastTimer;

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
async function api(path) {
  const response = await fetch(`${API}/${path}`);
  if (!response.ok) throw new Error("Error de conexión");
  return response.json();
}
function status(message = "") { el.status.textContent = message; }
function toast(message) {
  el.toast.textContent = message; el.toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}
function saveFavorites() {
  localStorage.setItem("recetarioFavoritos", JSON.stringify(favorites));
  el.count.textContent = favorites.length;
}
function favorite(id) { return favorites.some(m => m.idMeal === id); }
function setNav(button) {
  [el.home, el.favorites, el.random].forEach(b => b.classList.toggle("active", b === button));
}
function renderCategories(selected = "") {
  const names = ["Todas","Pasta","Pollo","Postres","Pescado","Carne","Vegetariano","Sopas"];
  el.categories.innerHTML = names.map(name => {
    const value = name === "Todas" ? "" : name;
    return `<button class="category-button ${selected.toLowerCase() === value.toLowerCase() ? "active" : ""}" data-category="${esc(value)}" type="button">${name}</button>`;
  }).join("");
}
function render(meals) {
  recipes = meals || [];
  if (!recipes.length) {
    el.grid.innerHTML = '<div class="empty-state">No encontramos recetas. Prueba con otra búsqueda.</div>';
    return;
  }
  el.grid.innerHTML = recipes.map(m => `<article class="recipe-card">
    <img src="${esc(m.strMealThumb || "")}" alt="${esc(m.strMeal)}" loading="lazy">
    <div class="recipe-card-body"><h3>${esc(m.strMeal)}</h3>
    <p class="recipe-meta">${esc(m.strCategory || "Receta")} · ${esc(m.strArea || "Internacional")}</p>
    <div class="recipe-card-actions"><button class="outline" data-open="${esc(m.idMeal)}" type="button">Ver receta</button>
    <button class="favorite-button ${favorite(m.idMeal) ? "saved" : ""}" data-favorite="${esc(m.idMeal)}" type="button" aria-label="Favoritos">${favorite(m.idMeal) ? "♥" : "♡"}</button></div></div></article>`).join("");
}
async function home() {
  mode = "home"; el.input.value = ""; setNav(el.home); renderCategories();
  el.title.textContent = "Recetas"; el.eyebrow.textContent = "Algunas recetas para empezar";
  status("Cargando recetas..."); el.grid.innerHTML = "";
  try {
    const data = await api("search.php?s=chicken");
    const more = await api("search.php?s=pasta");
    const map = new Map();
    [...(data.meals || []), ...(more.meals || [])].forEach(m => map.set(m.idMeal, m));
    status(""); render([...map.values()].slice(0, 12));
  } catch { status("No pudimos cargar las recetas. Comprueba tu conexión a internet."); }
}
async function search(query) {
  query = query.trim();
  if (!query) return toast("Escribe el nombre de una receta.");
  mode = "search"; renderCategories(); setNav(el.home);
  el.title.textContent = `Resultados para: ${query}`; el.eyebrow.textContent = "";
  status("Buscando recetas..."); el.grid.innerHTML = "";
  try { const data = await api(`search.php?s=${encodeURIComponent(query)}`); status(""); render(data.meals || []); }
  catch { status("No se pudo realizar la búsqueda."); }
}
async function category(name) {
  if (!name) return home();
  mode = "category"; renderCategories(name); setNav(el.home);
  el.title.textContent = `Categoría: ${name}`; el.eyebrow.textContent = "";
  status("Cargando recetas..."); el.grid.innerHTML = "";
  try {
    const data = await api(`filter.php?c=${encodeURIComponent(name)}`);
    status(""); render((data.meals || []).slice(0, 12).map(m => ({...m, strCategory:name, strArea:""})));
  } catch { status("No se pudo cargar esta categoría."); }
}
function showFavorites() {
  mode = "favorites"; setNav(el.favorites); renderCategories();
  el.title.textContent = "Mis favoritos"; el.eyebrow.textContent = "Recetas guardadas en este dispositivo";
  status(""); render(favorites);
  if (!favorites.length) el.grid.innerHTML = '<div class="empty-state">Aún no tienes favoritos. Pulsa el corazón de una receta para guardarla.</div>';
}
function toggleFavorite(id) {
  const found = favorites.findIndex(m => m.idMeal === id);
  if (found >= 0) { favorites.splice(found, 1); toast("Eliminada de favoritos."); }
  else {
    const meal = recipes.find(m => m.idMeal === id);
    if (meal) {
      favorites.push({idMeal:meal.idMeal,strMeal:meal.strMeal,strMealThumb:meal.strMealThumb,strCategory:meal.strCategory || "Receta",strArea:meal.strArea || "Internacional"});
      toast("Añadida a favoritos.");
    }
  }
  saveFavorites();
  if (mode === "favorites") showFavorites(); else render(recipes);
}
function ingredients(meal) {
  const list = [];
  for (let i=1;i<=20;i++) {
    const name = meal[`strIngredient${i}`], amount = meal[`strMeasure${i}`];
    if (name && name.trim()) list.push(`${amount ? amount.trim()+" " : ""}${name.trim()}`);
  }
  return list;
}
async function openRecipe(id) {
  el.dialogContent.innerHTML = '<div class="dialog-recipe-body">Cargando receta...</div>';
  el.dialog.showModal();
  try {
    const data = await api(`lookup.php?i=${encodeURIComponent(id)}`);
    const m = data.meals?.[0]; if (!m) throw new Error("Sin receta");
    if (!recipes.some(x => x.idMeal === m.idMeal)) recipes.push(m);
    el.dialogContent.innerHTML = `<img class="dialog-recipe-image" src="${esc(m.strMealThumb)}" alt="${esc(m.strMeal)}">
      <div class="dialog-recipe-body"><h2>${esc(m.strMeal)}</h2><p class="recipe-meta">${esc(m.strCategory || "Receta")} · ${esc(m.strArea || "Internacional")}</p>
      <button class="outline" data-dialog-favorite="${esc(m.idMeal)}" type="button">${favorite(m.idMeal) ? "♥ Quitar de favoritos" : "♡ Guardar en favoritos"}</button>
      <h3>Ingredientes</h3><ul>${ingredients(m).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
      <h3>Preparación</h3><p class="instructions">${esc(m.strInstructions || "No hay instrucciones disponibles.")}</p>
      ${m.strSource ? `<p><a href="${esc(m.strSource)}" target="_blank" rel="noopener noreferrer">Fuente original</a></p>` : ""}</div>`;
  } catch { el.dialogContent.innerHTML = '<div class="dialog-recipe-body">No se pudo abrir esta receta. Inténtalo de nuevo.</div>'; }
}
async function randomRecipe() {
  setNav(el.random); status("Buscando receta aleatoria...");
  try { const data = await api("random.php"); const m = data.meals?.[0]; if (!m) throw new Error(); await openRecipe(m.idMeal); status(""); }
  catch { status("No se pudo obtener una receta aleatoria."); }
}

el.form.addEventListener("submit", e => { e.preventDefault(); search(el.input.value); });
el.categories.addEventListener("click", e => { const b=e.target.closest("[data-category]"); if (b) category(b.dataset.category); });
el.grid.addEventListener("click", e => {
  const open=e.target.closest("[data-open]"), fav=e.target.closest("[data-favorite]");
  if (open) openRecipe(open.dataset.open);
  if (fav) toggleFavorite(fav.dataset.favorite);
});
el.dialogContent.addEventListener("click", e => {
  const b=e.target.closest("[data-dialog-favorite]"); if (!b) return;
  const id=b.dataset.dialogFavorite;
  if (!recipes.some(m=>m.idMeal===id)) {
    const title=el.dialogContent.querySelector("h2")?.textContent || "Receta";
    const img=el.dialogContent.querySelector("img")?.src || "";
    recipes.push({idMeal:id,strMeal:title,strMealThumb:img,strCategory:"Receta",strArea:"Internacional"});
  }
  toggleFavorite(id);
  b.textContent = favorite(id) ? "♥ Quitar de favoritos" : "♡ Guardar en favoritos";
});
el.close.addEventListener("click", () => el.dialog.close());
el.dialog.addEventListener("click", e => { if (e.target === el.dialog) el.dialog.close(); });
[el.home, el.footerHome, el.homeLink].forEach(b => b.addEventListener("click", e => { e.preventDefault(); home(); }));
[el.favorites, el.footerFavorites].forEach(b => b.addEventListener("click", showFavorites));
[el.random, el.footerRandom].forEach(b => b.addEventListener("click", randomRecipe));
saveFavorites(); renderCategories(); home();
