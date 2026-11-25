require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "public", "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error("Configure SESSION_SECRET e ADMIN_PASSWORD no arquivo .env antes de iniciar.");
  process.exit(1);
}

const db = new Database(path.join(DATA_DIR, "fepami.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'admin',
 phone TEXT NOT NULL DEFAULT '',
 can_edit_content INTEGER NOT NULL DEFAULT 1,
 can_edit_events INTEGER NOT NULL DEFAULT 1,
 can_edit_locations INTEGER NOT NULL DEFAULT 1,
 can_edit_photos INTEGER NOT NULL DEFAULT 1,
 can_delete_registrations INTEGER NOT NULL DEFAULT 0,
 auth_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS content (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 festival TEXT NOT NULL,
 title TEXT NOT NULL,
 date TEXT DEFAULT '',
 time TEXT DEFAULT '',
 location TEXT DEFAULT '',
 description TEXT DEFAULT '',
 image TEXT DEFAULT '',
 registration_mode TEXT NOT NULL DEFAULT 'info',
 registration_end_date TEXT NOT NULL DEFAULT '',
 created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS event_categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 min_age INTEGER NOT NULL,
 max_age INTEGER NOT NULL,
 capacity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event_registrations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 category_id INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
 student_name TEXT NOT NULL,
 instructor_name TEXT NOT NULL,
 age INTEGER NOT NULL,
 belt TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS locations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 address TEXT DEFAULT '',
 city TEXT DEFAULT '',
 phone TEXT DEFAULT '',
 instagram TEXT DEFAULT '',
 notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS photos (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT DEFAULT '',
 image TEXT NOT NULL,
 category TEXT DEFAULT 'Galeria',
 section TEXT NOT NULL DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
const eventColumns = db.prepare("PRAGMA table_info(events)").all().map(column => column.name);
if (!eventColumns.includes("registration_mode")) db.exec("ALTER TABLE events ADD COLUMN registration_mode TEXT NOT NULL DEFAULT 'info'");
if (!eventColumns.includes("registration_end_date")) db.exec("ALTER TABLE events ADD COLUMN registration_end_date TEXT NOT NULL DEFAULT ''");
if (!eventColumns.includes("created_by")) db.exec("ALTER TABLE events ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
if (!db.prepare("PRAGMA table_info(photos)").all().some(column => column.name === "section")) {
  db.exec("ALTER TABLE photos ADD COLUMN section TEXT NOT NULL DEFAULT ''");
}

try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'"); } catch (_) {}
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(column => column.name);
if (!userColumns.includes("phone")) db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
const permissionColumns = {
  content: "can_edit_content",
  events: "can_edit_events",
  locations: "can_edit_locations",
  photos: "can_edit_photos"
};
for (const column of Object.values(permissionColumns)) {
  if (!userColumns.includes(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 1`);
}
if (!userColumns.includes("can_delete_registrations")) db.exec("ALTER TABLE users ADD COLUMN can_delete_registrations INTEGER NOT NULL DEFAULT 0");
if (!userColumns.includes("auth_version")) db.exec("ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone != ''");
const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (userCount === 0) {
  const username = (process.env.ADMIN_USER || "admin").trim();
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)").run(username, hash, "admin");
}
const defaults = {
  organization: "Federação Paulista de Artes Marciais Interestilos",
  subtitle: "FEPAMI",
  slogan: "Vencendo através do esporte • Criando campeões",
  about: "A FEPAMI promove formação e atividades relacionadas às artes marciais. Atualize este texto pelo painel administrativo.",
  email: "",
  phone: "",
  whatsapp1: "",
  whatsappName1: "",
  whatsapp2: "",
  whatsappName2: "",
  whatsapp3: "",
  whatsappName3: "",
  whatsapp4: "",
  whatsappName4: "",
  whatsapp5: "",
  whatsappName5: "",
  instagram: "",
  website: "https://interestilos.com.br"
};
const insertContent = db.prepare("INSERT OR IGNORE INTO content(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaults)) insertContent.run(k,v);
const legacyPhone = db.prepare("SELECT value FROM content WHERE key='phone'").get()?.value || "";
if (legacyPhone) {
  const whatsappKeys = ["whatsapp1","whatsapp2","whatsapp3","whatsapp4","whatsapp5"];
  const contacts = db.prepare(`SELECT value FROM content WHERE key IN (${whatsappKeys.map(() => "?").join(",")})`).all(...whatsappKeys);
  if (!contacts.some(contact => contact.value.trim())) {
    db.prepare("UPDATE content SET value=? WHERE key='whatsapp1'").run(legacyPhone);
  }
  db.prepare("UPDATE content SET value='' WHERE key='phone'").run();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: DATA_DIR }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(ROOT, "public")));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const registrationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${require("crypto").randomBytes(8).toString("hex")}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Formato não permitido. Use JPG, PNG, WEBP ou GIF."), allowed.includes(file.mimetype));
  }
});

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Faça login para continuar." });
  const user = db.prepare("SELECT username,role,auth_version FROM users WHERE id=?").get(req.session.user.id);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "A conta não está mais disponível. Faça login novamente." });
  }
  if (Number(req.session.user.authVersion || 0) !== user.auth_version) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "A senha foi alterada. Faça login novamente." });
  }
  req.session.user.username = user.username;
  req.session.user.role = user.role;
  req.session.user.authVersion = user.auth_version;
  return next();
}
function adminOnly(req, res, next) {
  if (req.session.user?.role === "admin") return next();
  return res.status(403).json({ error: "Esta ação exige acesso administrativo." });
}
function permissionGate(areas) {
  const columns = areas.map(area => permissionColumns[area]).filter(Boolean);
  return (req,res,next) => {
    if (req.session.user?.role === "admin") return next();
    if (!columns.length) return res.status(403).json({error:"Permissão inválida."});
    const user=db.prepare(`SELECT ${columns.join(",")} FROM users WHERE id=?`).get(req.session.user.id);
    if (user && columns.some(column => user[column] === 1)) return next();
    return res.status(403).json({error:"Seu acesso não permite alterar esta área."});
  };
}
function uploadPermission(req,res,next) {
  const area=req.query.area;
  if(area==="events") return permissionGate(["events"])(req,res,next);
  if(area==="photos") return permissionGate(["photos"])(req,res,next);
  return res.status(400).json({error:"Informe se o envio é para programação ou fotos."});
}
function currentPermissions(userId, role) {
  if (role === "admin") return {...Object.fromEntries(Object.keys(permissionColumns).map(area => [area,true])),deleteRegistrations:true};
  const columns=[...Object.values(permissionColumns),"can_delete_registrations"];
  const user=db.prepare(`SELECT ${columns.join(",")} FROM users WHERE id=?`).get(userId);
  return {
    ...Object.fromEntries(Object.entries(permissionColumns).map(([area,column]) => [area,Boolean(user?.[column])])),
    deleteRegistrations:Boolean(user?.can_delete_registrations)
  };
}
function clean(v, max=2000) {
  return String(v ?? "").trim().slice(0, max);
}
function normalizePhone(value) {
  const input = String(value ?? "").trim();
  const digits = input.replace(/\D/g, "");
  const normalized = input.startsWith("+")
    ? `+${digits}`
    : digits.length === 10 || digits.length === 11
      ? `+55${digits}`
      : digits.startsWith("55")
        ? `+${digits}`
        : "";
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : "";
}
function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
        && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function allContent() {
  return Object.fromEntries(db.prepare("SELECT key,value FROM content").all().map(x => [x.key,x.value]));
}
function safeDeleteImage(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const filename = path.basename(url);
  const full = path.join(UPLOAD_DIR, filename);
  if (full.startsWith(UPLOAD_DIR) && fs.existsSync(full)) fs.unlinkSync(full);
}
const PHOTO_SECTIONS = new Set([
  "inicio", "sobre", "formacao", "liga", "festival-artes", "festival-ludico",
  "festival-lutas", "tematico", "campeoes"
]);

app.get("/api/site", (_req,res) => {
  res.set("Cache-Control", "no-store");
  const today=saoPauloDate();
  const events=db.prepare("SELECT id,festival,title,date,time,location,description,image,registration_mode,registration_end_date FROM events ORDER BY date,id").all()
    .map(event=>{
      const categories=db.prepare(`
        SELECT c.id,c.name,c.min_age AS minAge,c.max_age AS maxAge,c.capacity,COUNT(r.id) AS registered
        FROM event_categories c LEFT JOIN event_registrations r ON r.category_id=c.id
        WHERE c.event_id=? GROUP BY c.id ORDER BY c.min_age,c.name
      `).all(event.id).map(category=>({
        id:category.id,
        name:category.name,
        minAge:category.minAge,
        maxAge:category.maxAge,
        capacity:category.capacity,
        full:category.registered>=category.capacity
      }));
      const registrationClosed=event.registration_mode==="registration" && event.registration_end_date<today;
      const registrationCount=registrationClosed
        ? db.prepare("SELECT COUNT(*) AS count FROM event_registrations WHERE event_id=?").get(event.id).count
        : undefined;
      const publicRegistrations=registrationClosed
        ? db.prepare(`
          SELECT r.student_name AS name,c.name AS category
          FROM event_registrations r JOIN event_categories c ON c.id=r.category_id
          WHERE r.event_id=? ORDER BY r.student_name COLLATE NOCASE,r.id
        `).all(event.id)
        : undefined;
      return {
        id:event.id,
        festival:event.festival,
        title:event.title,
        date:event.date,
        time:event.time,
        location:event.location,
        description:event.description,
        image:event.image,
        registrationMode:event.registration_mode,
        registrationEndDate:event.registration_end_date,
        registrationClosed,
        categories,
        ...(registrationClosed?{registrationCount,publicRegistrations}:{})
      };
    });
  res.json({
    content: allContent(),
    events,
    locations: db.prepare("SELECT * FROM locations ORDER BY name").all(),
    photos: db.prepare("SELECT * FROM photos ORDER BY id DESC").all()
  });
});

app.post("/api/login", loginLimiter, (req,res) => {
  const username = clean(req.body.username, 80);
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Usuário ou senha incorretos." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Não foi possível iniciar a sessão." });
    req.session.user = { id: user.id, username: user.username, role: user.role, authVersion: user.auth_version };
    res.json({ ok: true, username: user.username });
  });
});
app.post("/api/logout", auth, (req,res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", (req,res) => {
  if (!req.session.user) return res.json({loggedIn:false,username:"",role:"",permissions:{}});
  const user=db.prepare("SELECT id,username,role,auth_version FROM users WHERE id=?").get(req.session.user.id);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({loggedIn:false,username:"",role:"",permissions:{}});
  }
  if(Number(req.session.user.authVersion||0)!==user.auth_version) {
    req.session.destroy(() => {});
    return res.json({loggedIn:false,username:"",role:"",permissions:{}});
  }
  req.session.user.username=user.username;
  req.session.user.role=user.role;
  req.session.user.authVersion=user.auth_version;
  res.json({loggedIn:true,username:user.username,role:user.role,permissions:currentPermissions(user.id,user.role)});
});

app.put("/api/content", auth, permissionGate(["content"]), (req,res) => {
  const allowed = ["organization","subtitle","slogan","about","email","phone","whatsapp1","whatsappName1","whatsapp2","whatsappName2","whatsapp3","whatsappName3","whatsapp4","whatsappName4","whatsapp5","whatsappName5","instagram","website"];
  const stmt = db.prepare("INSERT INTO content(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const tx = db.transaction(data => {
    for (const key of allowed) if (data[key] !== undefined) stmt.run(key, clean(data[key], 5000));
  });
  tx(req.body || {});
  res.json({ ok: true, content: allContent() });
});

app.post("/api/events", auth, permissionGate(["events"]), (req,res) => {
  const d=req.body||{};
  const festival=clean(d.festival,120);
  const title=clean(d.title,160);
  if(!festival||!title) return res.status(400).json({error:"Festival e título são obrigatórios."});
  const registrationMode=d.registrationMode==="registration"?"registration":"info";
  const registrationEndDate=registrationMode==="registration"?clean(d.registrationEndDate,10):"";
  let categories=[];
  if(registrationMode==="registration"){
    const eventDate=clean(d.date,10);
    if(!isValidDateOnly(registrationEndDate)||registrationEndDate<saoPauloDate())
      return res.status(400).json({error:"Informe uma data de encerramento válida, igual ou posterior a hoje."});
    if(eventDate&&(!isValidDateOnly(eventDate)||registrationEndDate>eventDate))
      return res.status(400).json({error:"O prazo de inscrição deve ser até a data do evento."});
    if(!Array.isArray(d.categories)||d.categories.length<1||d.categories.length>30||d.categories.some(category=>!category||typeof category!=="object"))
      return res.status(400).json({error:"Cadastre de 1 a 30 categorias para aceitar inscrições."});
    categories=d.categories.map(category=>({
      name:clean(category.name,100),
      minAge:String(category.minAge??"").trim()===""?NaN:Number(category.minAge),
      maxAge:String(category.maxAge??"").trim()===""?NaN:Number(category.maxAge),
      capacity:String(category.capacity??"").trim()===""?NaN:Number(category.capacity)
    }));
    if(categories.some(category=>
      !category.name
      ||!Number.isInteger(category.minAge)
      ||!Number.isInteger(category.maxAge)
      ||category.minAge<0
      ||category.maxAge<category.minAge
      ||category.maxAge>120
      ||!Number.isInteger(category.capacity)
      ||category.capacity<1
      ||category.capacity>10000
    )) return res.status(400).json({error:"Confira o nome, a faixa etária e o limite de cada categoria."});
    const categoryNames=categories.map(category=>category.name.toLocaleLowerCase("pt-BR"));
    if(new Set(categoryNames).size!==categoryNames.length)
      return res.status(400).json({error:"Os nomes das categorias devem ser únicos."});
  }
  const createEvent=db.transaction(data=>{
    const info=db.prepare(`
      INSERT INTO events(festival,title,date,time,location,description,image,registration_mode,registration_end_date,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(
      data.festival,data.title,data.date,data.time,data.location,data.description,data.image,
      data.registrationMode,data.registrationEndDate,data.userId
    );
    const eventId=Number(info.lastInsertRowid);
    const insertCategory=db.prepare("INSERT INTO event_categories(event_id,name,min_age,max_age,capacity) VALUES(?,?,?,?,?)");
    for(const category of data.categories)
      insertCategory.run(eventId,category.name,category.minAge,category.maxAge,category.capacity);
    return eventId;
  });
  const id=createEvent.immediate({
    festival,
    title,
    date:clean(d.date,30),
    time:clean(d.time,30),
    location:clean(d.location,250),
    description:clean(d.description,3000),
    image:clean(d.image,500),
    registrationMode,
    registrationEndDate,
    categories,
    userId:req.session.user.id
  });
  res.json({ok:true,id});
});
app.put("/api/events/:id", auth, permissionGate(["events"]), (req,res) => {
  const d=req.body||{};
  db.prepare("UPDATE events SET festival=?,title=?,date=?,time=?,location=?,description=?,image=? WHERE id=?")
    .run(clean(d.festival,120),clean(d.title,160),clean(d.date,30),clean(d.time,30),clean(d.location,250),clean(d.description,3000),clean(d.image,500),Number(req.params.id));
  res.json({ok:true});
});
app.delete("/api/events/:id", auth, permissionGate(["events"]), (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).json({error:"Evento inválido."});
  const event=db.prepare("SELECT registration_mode,created_by FROM events WHERE id=?").get(id);
  if(!event) return res.status(404).json({error:"Evento não encontrado."});
  if(event.registration_mode==="registration"&&req.session.user.role!=="admin"&&event.created_by!==req.session.user.id)
    return res.status(403).json({error:"Somente o responsável pelo evento ou um administrador pode excluí-lo."});
  db.prepare("DELETE FROM events WHERE id=?").run(id);
  res.json({ok:true});
});
app.post("/api/events/:id/registrations", registrationLimiter, (req,res) => {
  const eventId=Number(req.params.id);
  if(!Number.isInteger(eventId)||eventId<1) return res.status(400).json({error:"Evento inválido."});
  const d=req.body||{};
  const studentName=clean(d.studentName,150);
  const instructorName=clean(d.instructorName,150);
  const age=Number(d.age);
  const belt=clean(d.belt,80);
  const phone=normalizePhone(d.phone);
  const email=clean(d.email,254).toLowerCase();
  if(!studentName||!instructorName||String(d.age??"").trim()===""||!Number.isInteger(age)||age<0||age>120||!belt||!phone||!email||d.consent!==true)
    return res.status(400).json({error:"Preencha todos os dados e confirme a autorização para concluir a inscrição."});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({error:"Informe um e-mail válido."});
  const categoryId=Number(d.categoryId);
  if(!Number.isInteger(categoryId)||categoryId<1) return res.status(400).json({error:"Selecione uma categoria válida."});
  const register=db.transaction(data=>{
    const event=db.prepare("SELECT registration_mode,registration_end_date FROM events WHERE id=?").get(data.eventId);
    if(!event) return {status:404,error:"Evento não encontrado."};
    if(event.registration_mode!=="registration") return {status:400,error:"Este evento não aceita inscrições."};
    if(event.registration_end_date<saoPauloDate()) return {status:409,error:"O prazo de inscrição foi encerrado."};
    const category=db.prepare("SELECT id,min_age,max_age,capacity FROM event_categories WHERE id=? AND event_id=?").get(data.categoryId,data.eventId);
    if(!category) return {status:400,error:"A categoria selecionada não pertence a este evento."};
    if(data.age<category.min_age||data.age>category.max_age)
      return {status:400,error:"A idade informada não corresponde à faixa da categoria selecionada."};
    const count=db.prepare("SELECT COUNT(*) AS count FROM event_registrations WHERE category_id=?").get(data.categoryId).count;
    if(count>=category.capacity) return {status:409,error:"As vagas desta categoria foram preenchidas."};
    db.prepare(`
      INSERT INTO event_registrations(event_id,category_id,student_name,instructor_name,age,belt,phone,email)
      VALUES(?,?,?,?,?,?,?,?)
    `).run(data.eventId,data.categoryId,data.studentName,data.instructorName,data.age,data.belt,data.phone,data.email);
    return {status:201,ok:true};
  });
  const result=register.immediate({
    eventId,
    categoryId,
    studentName,
    instructorName,
    age,
    belt,
    phone,
    email
  });
  if(result.error) return res.status(result.status).json({error:result.error});
  res.status(result.status).json({ok:true});
});
app.get("/api/registrations", auth, permissionGate(["events"]), (req,res) => {
  res.set("Cache-Control","no-store");
  const isAdmin=req.session.user.role==="admin";
  const today=saoPauloDate();
  const events=isAdmin
    ? db.prepare("SELECT id,festival,title,date,time,location,registration_end_date FROM events WHERE registration_mode='registration' ORDER BY registration_end_date,id").all()
    : db.prepare("SELECT id,festival,title,date,time,location,registration_end_date FROM events WHERE registration_mode='registration' AND created_by=? ORDER BY registration_end_date,id").all(req.session.user.id);
  const categoriesForEvent=db.prepare(`
    SELECT c.id,c.name,c.min_age AS minAge,c.max_age AS maxAge,c.capacity
    FROM event_categories c WHERE c.event_id=? ORDER BY c.min_age,c.name
  `);
  const registrationsForCategory=db.prepare(`
    SELECT id,student_name AS studentName,instructor_name AS instructorName,age,belt,phone,email,created_at AS createdAt
    FROM event_registrations WHERE category_id=? ORDER BY student_name COLLATE NOCASE,id
  `);
  res.json(events.map(event=>({
    ...event,
    registrationEndDate:event.registration_end_date,
    registrationClosed:event.registration_end_date<today,
    categories:categoriesForEvent.all(event.id).map(category=>({
      ...category,
      registrations:registrationsForCategory.all(category.id)
    }))
  })));
});
app.delete("/api/registrations/:id", auth, permissionGate(["events"]), (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).json({error:"Inscrição inválida."});
  const isAdmin=req.session.user.role==="admin";
  if(!isAdmin){
    const user=db.prepare("SELECT can_delete_registrations FROM users WHERE id=?").get(req.session.user.id);
    if(user?.can_delete_registrations!==1)
      return res.status(403).json({error:"O administrador ainda não autorizou a exclusão de inscrições."});
  }
  const removeRegistration=db.transaction(registrationId=>{
    const registration=db.prepare(`
      SELECT e.created_by,e.registration_end_date
      FROM event_registrations r JOIN events e ON e.id=r.event_id
      WHERE r.id=?
    `).get(registrationId);
    if(!registration) return {status:404,error:"Inscrição não encontrada."};
    if(!isAdmin&&registration.created_by!==req.session.user.id)
      return {status:403,error:"Você só pode excluir inscrições dos eventos que cadastrou."};
    if(registration.registration_end_date<saoPauloDate())
      return {status:409,error:"O prazo terminou. As inscrições não podem mais ser excluídas."};
    db.prepare("DELETE FROM event_registrations WHERE id=?").run(registrationId);
    return {ok:true};
  });
  const result=removeRegistration.immediate(id);
  if(result.error) return res.status(result.status).json({error:result.error});
  res.json({ok:true});
});

app.post("/api/locations", auth, permissionGate(["locations"]), (req,res) => {
  const d=req.body||{};
  if (!clean(d.name,160)) return res.status(400).json({error:"Informe o nome do local."});
  const info=db.prepare("INSERT INTO locations(name,address,city,phone,instagram,notes) VALUES(?,?,?,?,?,?)")
    .run(clean(d.name,160),clean(d.address,300),clean(d.city,120),clean(d.phone,80),clean(d.instagram,200),clean(d.notes,1000));
  res.json({ok:true,id:info.lastInsertRowid});
});
app.put("/api/locations/:id", auth, permissionGate(["locations"]), (req,res) => {
  const d=req.body||{};
  db.prepare("UPDATE locations SET name=?,address=?,city=?,phone=?,instagram=?,notes=? WHERE id=?")
    .run(clean(d.name,160),clean(d.address,300),clean(d.city,120),clean(d.phone,80),clean(d.instagram,200),clean(d.notes,1000),Number(req.params.id));
  res.json({ok:true});
});
app.delete("/api/locations/:id", auth, permissionGate(["locations"]), (req,res) => {
  db.prepare("DELETE FROM locations WHERE id=?").run(Number(req.params.id));
  res.json({ok:true});
});

app.post("/api/upload", auth, uploadPermission, upload.single("photo"), (req,res) => {
  if (!req.file) return res.status(400).json({error:"Selecione uma imagem."});
  res.json({ok:true,url:`/uploads/${req.file.filename}`});
});
app.post("/api/photos", auth, permissionGate(["photos"]), (req,res) => {
  const d=req.body||{};
  if (!clean(d.image,500)) return res.status(400).json({error:"Envie uma foto primeiro."});
  const section=clean(d.section,80);
  if (!PHOTO_SECTIONS.has(section)) return res.status(400).json({error:"Selecione uma seção válida para a foto."});
  const info=db.prepare("INSERT INTO photos(title,image,category,section) VALUES(?,?,?,?)")
    .run(clean(d.title,160),clean(d.image,500),clean(d.category,120),section);
  res.json({ok:true,id:info.lastInsertRowid});
});
app.put("/api/photos/:id", auth, permissionGate(["photos"]), (req,res) => {
  const id=Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({error:"Foto inválida."});
  const section=clean(req.body?.section,80);
  if (section && !PHOTO_SECTIONS.has(section)) return res.status(400).json({error:"Selecione uma seção válida para a foto."});
  const photo=db.prepare("SELECT id FROM photos WHERE id=?").get(id);
  if (!photo) return res.status(404).json({error:"Foto não encontrada."});
  db.prepare("UPDATE photos SET section=? WHERE id=?").run(section,id);
  res.json({ok:true});
});
app.delete("/api/photos/:id", auth, permissionGate(["photos"]), (req,res) => {
  const id=Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({error:"Foto inválida."});
  const photo=db.prepare("SELECT image FROM photos WHERE id=?").get(id);
  if (!photo) return res.status(404).json({error:"Foto não encontrada."});
  db.prepare("DELETE FROM photos WHERE id=?").run(id);
  const stillInUse = db.prepare("SELECT 1 FROM photos WHERE image=? UNION ALL SELECT 1 FROM events WHERE image=? LIMIT 1").get(photo.image,photo.image);
  if (!stillInUse) safeDeleteImage(photo.image);
  res.json({ok:true});
});


app.get("/api/users", auth, adminOnly, (_req,res) => {
  res.json(db.prepare("SELECT id,username,role,phone,can_edit_content,can_edit_events,can_edit_locations,can_edit_photos,can_delete_registrations FROM users ORDER BY id").all());
});
app.post("/api/users", auth, adminOnly, (req,res) => {
  const username=clean(req.body.username,80);
  const password=String(req.body.password||"");
  const role=req.body.role==="admin"?"admin":"teacher";
  const phoneInput=String(req.body.phone||"").trim();
  const phone=phoneInput?normalizePhone(phoneInput):"";
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) return res.status(400).json({error:"Usuário: use 3 a 80 caracteres (letras, números, ponto, hífen ou sublinhado)."});
  if(password.length<12) return res.status(400).json({error:"A senha precisa ter pelo menos 12 caracteres."});
  if(phoneInput&&!phone) return res.status(400).json({error:"Informe um telefone válido com código do país e DDD."});
  try {
    db.prepare("INSERT INTO users(username,password_hash,role,phone) VALUES(?,?,?,?)")
      .run(username,bcrypt.hashSync(password,12),role,phone);
    res.json({ok:true});
  } catch (error) {
    if(error.code==="SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({error:"Este usuário ou telefone já está cadastrado."});
    throw error;
  }
});
app.put("/api/users/:id", auth, adminOnly, (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).json({error:"Usuário inválido."});
  const target=db.prepare("SELECT role FROM users WHERE id=?").get(id);
  if(!target) return res.status(404).json({error:"Usuário não encontrado."});
  const username=clean(req.body.username,80);
  const phoneInput=String(req.body.phone||"").trim();
  const phone=phoneInput?normalizePhone(phoneInput):"";
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) return res.status(400).json({error:"Usuário: use 3 a 80 caracteres (letras, números, ponto, hífen ou sublinhado)."});
  if(phoneInput&&!phone) return res.status(400).json({error:"Informe um telefone válido com código do país e DDD."});
  try {
    db.prepare("UPDATE users SET username=?,phone=? WHERE id=?").run(username,phone,id);
    res.json({ok:true});
  } catch (error) {
    if(error.code==="SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({error:"Este usuário ou telefone já está cadastrado."});
    throw error;
  }
});
app.put("/api/users/:id/permissions", auth, adminOnly, (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).json({error:"Usuário inválido."});
  const target=db.prepare("SELECT role FROM users WHERE id=?").get(id);
  if(!target||target.role!=="teacher") return res.status(404).json({error:"Professor não encontrado."});
  const permissions=req.body?.permissions;
  if(!permissions||Object.keys(permissionColumns).some(area=>typeof permissions[area]!=="boolean")||typeof permissions.deleteRegistrations!=="boolean")
    return res.status(400).json({error:"Informe as permissões válidas para cada área."});
  const columns=[...Object.values(permissionColumns),"can_delete_registrations"];
  const values=[...Object.keys(permissionColumns).map(area=>Number(permissions[area])),Number(permissions.deleteRegistrations),id];
  db.prepare(`UPDATE users SET ${columns.map(column=>`${column}=?`).join(",")} WHERE id=?`).run(...values);
  res.json({ok:true});
});
app.put("/api/users/:id/password", auth, adminOnly, (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).json({error:"Usuário inválido."});
  const target=db.prepare("SELECT role FROM users WHERE id=?").get(id);
  if(!target||target.role!=="teacher") return res.status(404).json({error:"Professor não encontrado."});
  const password=String(req.body.password||"");
  if(password.length<12) return res.status(400).json({error:"A senha precisa ter pelo menos 12 caracteres."});
  db.prepare("UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?").run(bcrypt.hashSync(password,12),id);
  res.json({ok:true});
});
app.delete("/api/users/:id", auth, adminOnly, (req,res) => {
  const id=Number(req.params.id);
  if(id===req.session.user.id) return res.status(400).json({error:"Você não pode excluir a própria conta."});
  const target=db.prepare("SELECT role FROM users WHERE id=?").get(id);
  if(!target) return res.status(404).json({error:"Usuário não encontrado."});
  if(target.role==="admin" && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n<=1)
    return res.status(400).json({error:"Mantenha pelo menos um administrador."});
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ok:true});
});

app.post("/api/change-password", auth, adminOnly, (req,res) => {
  const current=String(req.body.currentPassword||"");
  const next=String(req.body.newPassword||"");
  if(next.length<12) return res.status(400).json({error:"A nova senha precisa ter pelo menos 12 caracteres."});
  const user=db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id);
  if(!bcrypt.compareSync(current,user.password_hash)) return res.status(400).json({error:"Senha atual incorreta."});
  db.prepare("UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?").run(bcrypt.hashSync(next,12),user.id);
  req.session.user.authVersion=user.auth_version+1;
  res.json({ok:true});
});

app.use((err,_req,res,_next) => {
  console.error(err.message);
  res.status(400).json({error:err.message || "Ocorreu um erro."});
});
app.get("*", (_req,res) => res.sendFile(path.join(ROOT,"public","index.html")));
app.listen(PORT, () => console.log(`FEPAMI disponível em http://localhost:${PORT}`));
