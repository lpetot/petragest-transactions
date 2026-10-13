# Génère les visuels de démonstration (illustrations, aucune vraie photo) et les images
# provisoires de la charte si les vraies ne sont pas encore là.
# Windows uniquement (System.Drawing). Les fichiers produits sont déjà dans le dépôt :
# ce script ne sert qu'à les régénérer.
#   powershell -ExecutionPolicy Bypass -File scripts\demo\generer-visuels.ps1

$ErrorActionPreference = 'Stop'
$racine = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sortiePhotos = Join-Path $PSScriptRoot 'photos'
$sortieAssets = Join-Path $racine 'public\assets'
New-Item -ItemType Directory -Force $sortiePhotos | Out-Null

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;

public static class Visuels {
    static Random R;
    static Color C(string hex) { return ColorTranslator.FromHtml(hex); }
    static Color A(Color c, int a) { return Color.FromArgb(a, c); }
    static Color Mix(Color a, Color b, double t) {
        return Color.FromArgb((int)(a.R + (b.R - a.R) * t), (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));
    }
    static Graphics Prep(Bitmap b) {
        Graphics g = Graphics.FromImage(b);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        return g;
    }
    static void Grad(Graphics g, RectangleF r, Color a, Color b, float angle) {
        using (var br = new LinearGradientBrush(new RectangleF(r.X - 1, r.Y - 1, r.Width + 2, r.Height + 2), a, b, angle)) g.FillRectangle(br, r);
    }
    static void Rect(Graphics g, Color c, float x, float y, float w, float h) {
        using (var br = new SolidBrush(c)) g.FillRectangle(br, x, y, w, h);
    }
    static void Poly(Graphics g, Color c, params PointF[] p) {
        using (var br = new SolidBrush(c)) g.FillPolygon(br, p);
    }
    static void Ellipse(Graphics g, Color c, float x, float y, float w, float h) {
        using (var br = new SolidBrush(c)) g.FillEllipse(br, x, y, w, h);
    }
    static void Line(Graphics g, Color c, float w, float x1, float y1, float x2, float y2) {
        using (var p = new Pen(c, w)) g.DrawLine(p, x1, y1, x2, y2);
    }
    static PointF P(float x, float y) { return new PointF(x, y); }

    // Grain photographique léger, pour éviter l'aspect « aplat ».
    static void Grain(Graphics g, int w, int h, int n) {
        for (int i = 0; i < n; i++) {
            int v = R.Next(2) == 0 ? 0 : 255;
            Rect(g, Color.FromArgb(R.Next(4, 12), v, v, v), R.Next(w), R.Next(h), R.Next(1, 3), R.Next(1, 3));
        }
    }
    static void Vignette(Graphics g, int w, int h) {
        using (var path = new GraphicsPath()) {
            path.AddEllipse(-w * 0.25f, -h * 0.3f, w * 1.5f, h * 1.6f);
            using (var br = new PathGradientBrush(path)) {
                br.CenterColor = Color.FromArgb(0, 0, 0, 0);
                br.SurroundColors = new Color[] { Color.FromArgb(70, 10, 12, 20) };
                g.FillRectangle(br, 0, 0, w, h);
            }
        }
    }
    static void Mention(Graphics g, int w, int h) {
        using (var f = new Font("Segoe UI", h * 0.022f, FontStyle.Regular, GraphicsUnit.Pixel)) {
            string t = "Photo de démonstration";
            SizeF s = g.MeasureString(t, f);
            float x = w - s.Width - h * 0.03f, y = h - s.Height - h * 0.025f;
            using (var br = new SolidBrush(Color.FromArgb(110, 0, 0, 0))) g.DrawString(t, f, br, x + 1.5f, y + 1.5f);
            using (var br = new SolidBrush(Color.FromArgb(215, 255, 255, 255))) g.DrawString(t, f, br, x, y);
        }
    }

    static void Ciel(Graphics g, int w, float hauteur, string haut, string bas) {
        Grad(g, new RectangleF(0, 0, w, hauteur), C(haut), C(bas), 90f);
        // quelques nuages très doux
        for (int i = 0; i < 7; i++) {
            float cx = R.Next(w), cy = R.Next((int)(hauteur * 0.1), (int)(hauteur * 0.6));
            for (int k = 0; k < 6; k++)
                Ellipse(g, Color.FromArgb(22, 255, 255, 255), cx + R.Next(-120, 120), cy + R.Next(-20, 20), R.Next(140, 260), R.Next(40, 70));
        }
    }

    static void Arbre(Graphics g, float x, float sol, float taille, Color feuillage) {
        Rect(g, C("#5B4A3A"), x - taille * 0.04f, sol - taille * 0.55f, taille * 0.08f, taille * 0.55f);
        for (int i = 0; i < 14; i++) {
            float r = taille * (0.22f + (float)R.NextDouble() * 0.18f);
            float cx = x + (float)(R.NextDouble() - 0.5) * taille * 0.6f;
            float cy = sol - taille * 0.75f + (float)(R.NextDouble() - 0.5) * taille * 0.45f;
            Ellipse(g, A(Mix(feuillage, Color.Black, R.NextDouble() * 0.35), 225), cx - r, cy - r, r * 2, r * 2);
        }
    }

    // Fenêtre à la française : encadrement de pierre, petits carreaux, volets éventuels.
    static void Fenetre(Graphics g, float x, float y, float fw, float fh, Color pierre, bool volets, Color couleurVolet, bool reflet) {
        Rect(g, Mix(pierre, Color.White, 0.25), x - fw * 0.12f, y - fh * 0.08f, fw * 1.24f, fh * 1.14f);
        Grad(g, new RectangleF(x, y, fw, fh), C("#2E3A4F"), C("#6D7F99"), 60f);
        if (reflet) Poly(g, Color.FromArgb(55, 255, 255, 255), P(x, y + fh * 0.2f), P(x + fw * 0.55f, y), P(x + fw * 0.85f, y), P(x, y + fh * 0.5f));
        Color bois = C("#EDE6DA");
        Line(g, bois, fw * 0.06f, x + fw / 2, y, x + fw / 2, y + fh);
        for (int i = 1; i < 4; i++) Line(g, bois, fw * 0.035f, x, y + fh * i / 4, x + fw, y + fh * i / 4);
        using (var p = new Pen(bois, fw * 0.07f)) g.DrawRectangle(p, x, y, fw, fh);
        if (volets) {
            Rect(g, couleurVolet, x - fw * 0.62f, y, fw * 0.48f, fh);
            Rect(g, couleurVolet, x + fw * 1.14f, y, fw * 0.48f, fh);
            for (int i = 1; i < 9; i++) {
                Line(g, A(Color.Black, 30), 2, x - fw * 0.62f, y + fh * i / 9, x - fw * 0.14f, y + fh * i / 9);
                Line(g, A(Color.Black, 30), 2, x + fw * 1.14f, y + fh * i / 9, x + fw * 1.62f, y + fh * i / 9);
            }
        }
        Rect(g, Mix(pierre, Color.Black, 0.12), x - fw * 0.16f, y + fh * 1.04f, fw * 1.32f, fh * 0.05f);
    }

    // Façade classique : niveaux, travées, toit d'ardoise à la Mansart ou toit de tuiles.
    public static void Facade(string fichier, int w, int h, int niveaux, int travees, string pierreHex, bool mansarde, bool volets, string voletHex, bool porteCochere, string cielHaut, string cielBas, int graine) {
        R = new Random(graine);
        using (var b = new Bitmap(w, h))
        using (var g = Prep(b)) {
            float sol = h * 0.86f;
            Ciel(g, w, sol, cielHaut, cielBas);
            Color pierre = C(pierreHex);
            float largeur = w * (travees >= 7 ? 0.96f : 0.78f);
            float x0 = (w - largeur) / 2f;
            float hNiv = h * (niveaux >= 4 ? 0.13f : 0.16f);
            float haut = sol - hNiv * niveaux;
            // arbres en arrière-plan
            Arbre(g, x0 - w * 0.02f, sol, h * 0.55f, C("#5E7A55"));
            Arbre(g, x0 + largeur + w * 0.03f, sol, h * 0.5f, C("#62805A"));
            // corps de bâtiment
            Grad(g, new RectangleF(x0, haut, largeur, sol - haut), Mix(pierre, Color.White, 0.12), Mix(pierre, Color.Black, 0.08), 0f);
            // assises de pierre
            for (float yy = haut + 14; yy < sol; yy += h * 0.022f) Line(g, A(Mix(pierre, Color.Black, 0.3), 26), 1.2f, x0, yy, x0 + largeur, yy);
            // chaînes d'angle
            for (float yy = haut; yy < sol; yy += h * 0.044f) {
                Rect(g, Mix(pierre, Color.White, 0.2), x0, yy, largeur * 0.035f, h * 0.022f);
                Rect(g, Mix(pierre, Color.White, 0.2), x0 + largeur * 0.965f, yy + h * 0.022f, largeur * 0.035f, h * 0.022f);
            }
            // toit
            Color ardoise = C("#4A5264");
            if (mansarde) {
                float hToit = hNiv * 1.15f;
                Poly(g, ardoise, P(x0 - 8, haut), P(x0 + largeur + 8, haut), P(x0 + largeur - largeur * 0.05f, haut - hToit), P(x0 + largeur * 0.05f, haut - hToit));
                Poly(g, Mix(ardoise, Color.Black, 0.2f), P(x0 + largeur * 0.05f, haut - hToit), P(x0 + largeur * 0.95f, haut - hToit), P(x0 + largeur * 0.9f, haut - hToit * 1.35f), P(x0 + largeur * 0.1f, haut - hToit * 1.35f));
                // lucarnes
                for (int i = 0; i < travees; i++) {
                    if (travees > 5 && i % 2 == 1) continue;
                    float cx = x0 + largeur * (i + 0.5f) / travees;
                    float lw = largeur / travees * 0.36f;
                    Poly(g, Mix(pierre, Color.White, 0.3), P(cx - lw * 0.75f, haut - hToit * 0.15f), P(cx + lw * 0.75f, haut - hToit * 0.15f), P(cx + lw * 0.75f, haut - hToit * 0.75f), P(cx, haut - hToit * 1.05f), P(cx - lw * 0.75f, haut - hToit * 0.75f));
                    Grad(g, new RectangleF(cx - lw / 2, haut - hToit * 0.72f, lw, hToit * 0.52f), C("#2E3A4F"), C("#65768F"), 60f);
                }
                // cheminées
                Rect(g, Mix(pierre, Color.Black, 0.05), x0 + largeur * 0.18f, haut - hToit * 1.7f, largeur * 0.04f, hToit * 0.5f);
                Rect(g, Mix(pierre, Color.Black, 0.05), x0 + largeur * 0.78f, haut - hToit * 1.7f, largeur * 0.04f, hToit * 0.5f);
            } else {
                Color tuile = C("#9A5B3E");
                Poly(g, tuile, P(x0 - 18, haut), P(x0 + largeur + 18, haut), P(x0 + largeur * 0.82f, haut - hNiv * 0.9f), P(x0 + largeur * 0.18f, haut - hNiv * 0.9f));
                for (float xx = x0; xx < x0 + largeur; xx += 9) Line(g, A(Color.Black, 25), 1.5f, xx, haut, xx + (xx - (x0 + largeur / 2)) * -0.1f, haut - hNiv * 0.85f);
            }
            // corniche et bandeaux
            Rect(g, Mix(pierre, Color.White, 0.3), x0 - 10, haut - 6, largeur + 20, 14);
            for (int n = 1; n < niveaux; n++) Rect(g, Mix(pierre, Color.White, 0.22), x0 - 4, haut + hNiv * n - 4, largeur + 8, 8);
            // fenêtres
            for (int n = 0; n < niveaux; n++) {
                for (int i = 0; i < travees; i++) {
                    float cx = x0 + largeur * (i + 0.5f) / travees;
                    float fw = largeur / travees * (volets ? 0.3f : 0.4f);
                    float fh = hNiv * (n == 0 ? 0.62f : 0.66f);
                    float fy = haut + hNiv * n + hNiv * 0.16f;
                    bool porte = porteCochere && n == niveaux - 1 && i == travees / 2;
                    if (porte) continue;
                    Fenetre(g, cx - fw / 2, fy, fw, fh, pierre, volets, C(voletHex), R.Next(3) == 0);
                    if (n == 1) Rect(g, C("#2B2B2E"), cx - fw * 0.7f, fy + fh * 0.62f, fw * 1.4f, 5);
                }
            }
            if (porteCochere) {
                float cx = x0 + largeur * (travees / 2 + 0.5f) / travees;
                float pw = largeur / travees * 0.62f, ph = hNiv * 0.84f;
                float py = sol - ph;
                Rect(g, Mix(pierre, Color.White, 0.3), cx - pw * 0.62f, py - 12, pw * 1.24f, ph + 12);
                using (var path = new GraphicsPath()) {
                    path.AddArc(cx - pw / 2, py, pw, pw * 0.6f, 180, 180);
                    path.AddLine(cx + pw / 2, py + pw * 0.3f, cx + pw / 2, sol);
                    path.AddLine(cx + pw / 2, sol, cx - pw / 2, sol);
                    path.CloseFigure();
                    using (var br = new SolidBrush(C("#23324A"))) g.FillPath(br, path);
                }
                Line(g, A(Color.Black, 70), 3, cx, py + pw * 0.3f, cx, sol);
            }
            // sol pavé
            Grad(g, new RectangleF(0, sol, w, h - sol), C("#B8AE9F"), C("#8D8478"), 90f);
            for (float xx = -w; xx < w * 2; xx += 46) Line(g, A(Color.Black, 18), 1.2f, xx, h, w / 2 + (xx - w / 2) * 0.25f, sol);
            Vignette(g, w, h); Grain(g, w, h, 5000); Mention(g, w, h);
            Enregistrer(b, fichier);
        }
    }

    // Intérieur : pièce vue en perspective, parquet, moulures, grande fenêtre, cheminée.
    public static void Interieur(string fichier, int w, int h, string murHex, bool cheminee, bool lustre, string solHex, int graine) {
        R = new Random(graine);
        using (var b = new Bitmap(w, h))
        using (var g = Prep(b)) {
            Color mur = C(murHex);
            float fx = w * 0.26f, fy = h * 0.14f, fw = w * 0.48f, fhh = h * 0.56f; // mur du fond
            // plafond
            Grad(g, new RectangleF(0, 0, w, fy), Mix(mur, Color.White, 0.55), Mix(mur, Color.White, 0.35), 90f);
            Poly(g, Mix(mur, Color.White, 0.5), P(0, 0), P(w, 0), P(fx + fw, fy), P(fx, fy));
            // murs latéraux
            Poly(g, Mix(mur, Color.Black, 0.14), P(0, 0), P(fx, fy), P(fx, fy + fhh), P(0, h));
            Poly(g, Mix(mur, Color.Black, 0.06), P(w, 0), P(fx + fw, fy), P(fx + fw, fy + fhh), P(w, h));
            // mur du fond
            Grad(g, new RectangleF(fx, fy, fw, fhh), Mix(mur, Color.White, 0.1), mur, 90f);
            // moulures (cadres)
            using (var p = new Pen(A(Color.White, 150), 3)) {
                g.DrawRectangle(p, fx + fw * 0.05f, fy + fhh * 0.08f, fw * 0.2f, fhh * 0.55f);
                g.DrawRectangle(p, fx + fw * 0.75f, fy + fhh * 0.08f, fw * 0.2f, fhh * 0.55f);
                g.DrawLine(p, fx, fy + fhh * 0.72f, fx + fw, fy + fhh * 0.72f);
            }
            Rect(g, A(Color.White, 170), fx, fy, fw, 9);
            // grande fenêtre avec lumière
            float wx = fx + fw * 0.33f, wy = fy + fhh * 0.06f, ww = fw * 0.34f, wh = fhh * 0.86f;
            Grad(g, new RectangleF(wx, wy, ww, wh), C("#DDE8F2"), C("#F7F2E6"), 90f);
            g.SetClip(new RectangleF(wx, wy, ww, wh));
            Arbre(g, wx + ww * 0.3f, wy + wh * 1.05f, wh * 0.8f, C("#86A07A"));
            g.ResetClip();
            using (var p = new Pen(C("#F4F0E8"), 7)) {
                g.DrawRectangle(p, wx, wy, ww, wh);
                g.DrawLine(p, wx + ww / 2, wy, wx + ww / 2, wy + wh);
                for (int i = 1; i < 5; i++) g.DrawLine(p, wx, wy + wh * i / 5, wx + ww, wy + wh * i / 5);
            }
            // rideaux
            Poly(g, C("#E9DCC7"), P(wx - ww * 0.18f, wy - 10), P(wx + ww * 0.05f, wy - 10), P(wx, wy + wh), P(wx - ww * 0.26f, wy + wh));
            Poly(g, C("#E9DCC7"), P(wx + ww * 0.95f, wy - 10), P(wx + ww * 1.18f, wy - 10), P(wx + ww * 1.26f, wy + wh), P(wx + ww, wy + wh));
            // parquet en perspective (point de fuite)
            float sy = fy + fhh;
            Color sol = C(solHex);
            Poly(g, sol, P(0, h), P(fx, sy), P(fx + fw, sy), P(w, h));
            var cheminSol = new GraphicsPath();
            cheminSol.AddPolygon(new PointF[] { P(0, h), P(fx, sy), P(fx + fw, sy), P(w, h) });
            g.SetClip(cheminSol);
            float vx = w / 2f, vy = fy + fhh * 0.45f;
            for (int i = -14; i <= 14; i++) {
                float bx = w / 2f + i * w * 0.075f;
                Line(g, A(Mix(sol, Color.Black, 0.5), 60), 2, bx, h, vx + (bx - vx) * ((sy - vy) / (h - vy)), sy);
            }
            for (int i = 1; i < 9; i++) {
                float t = (float)Math.Pow(i / 9.0, 1.7);
                float yy = sy + (h - sy) * t;
                Line(g, A(Mix(sol, Color.Black, 0.5), 40), 1.5f, 0, yy, w, yy);
            }
            // lumière au sol
            Poly(g, Color.FromArgb(55, 255, 250, 235), P(wx, sy), P(wx + ww, sy), P(wx + ww * 1.6f, h), P(wx - ww * 0.4f, h));
            g.ResetClip();
            cheminSol.Dispose();
            if (cheminee) {
                float cx = fx + fw * 0.02f, cw = fw * 0.28f, ch = fhh * 0.3f;
                Rect(g, C("#F2EEE7"), fx + fw * 0.03f, sy - ch, cw, ch);
                Rect(g, C("#2A2522"), fx + fw * 0.03f + cw * 0.2f, sy - ch * 0.62f, cw * 0.6f, ch * 0.62f);
                Rect(g, C("#F7F4EF"), fx + fw * 0.01f, sy - ch - 10, cw * 1.08f, 12);
                Ellipse(g, Color.FromArgb(120, 255, 170, 80), fx + fw * 0.03f + cw * 0.33f, sy - ch * 0.3f, cw * 0.34f, ch * 0.22f);
            }
            // canapé et table basse
            float by = sy + (h - sy) * 0.35f;
            Rect(g, C("#34405A"), w * 0.56f, by, w * 0.3f, h * 0.1f);
            Rect(g, C("#3D4A66"), w * 0.56f, by - h * 0.08f, w * 0.3f, h * 0.09f);
            Rect(g, C("#2A3349"), w * 0.55f, by - h * 0.06f, w * 0.025f, h * 0.17f);
            Rect(g, C("#2A3349"), w * 0.855f, by - h * 0.06f, w * 0.025f, h * 0.17f);
            Ellipse(g, C("#6B4E36"), w * 0.33f, by + h * 0.09f, w * 0.18f, h * 0.05f);
            if (lustre) {
                Line(g, C("#C9A96E"), 2, w / 2f, 0, w / 2f, fy * 0.9f);
                for (int i = 0; i < 7; i++) Ellipse(g, Color.FromArgb(200, 255, 236, 190), w / 2f - 60 + i * 20 - 6, fy * 0.9f + (i % 2) * 8, 12, 12);
                Ellipse(g, Color.FromArgb(40, 255, 240, 200), w / 2f - 110, fy * 0.6f, 220, 120);
            }
            Vignette(g, w, h); Grain(g, w, h, 4500); Mention(g, w, h);
            Enregistrer(b, fichier);
        }
    }

    // Jardin ou parc, avec la maison au fond et éventuellement une piscine.
    public static void Jardin(string fichier, int w, int h, bool piscine, string pierreHex, int graine) {
        R = new Random(graine);
        using (var b = new Bitmap(w, h))
        using (var g = Prep(b)) {
            float horizon = h * 0.5f;
            Ciel(g, w, horizon + 20, "#8FB3D9", "#EAF0F2");
            Color pierre = C(pierreHex);
            // maison au loin
            float mx = w * 0.3f, mw = w * 0.4f, mh = h * 0.2f;
            Rect(g, pierre, mx, horizon - mh, mw, mh);
            Poly(g, C("#4A5264"), P(mx - 10, horizon - mh), P(mx + mw + 10, horizon - mh), P(mx + mw * 0.85f, horizon - mh * 1.6f), P(mx + mw * 0.15f, horizon - mh * 1.6f));
            for (int i = 0; i < 7; i++) for (int n = 0; n < 2; n++)
                Rect(g, C("#34435A"), mx + mw * (i + 0.3f) / 7, horizon - mh + mh * (0.15f + n * 0.45f), mw / 7 * 0.4f, mh * 0.3f);
            // arbres de part et d'autre
            for (int i = 0; i < 5; i++) Arbre(g, w * 0.03f + i * w * 0.045f, horizon + h * 0.03f, h * (0.3f + (float)R.NextDouble() * 0.12f), C("#4F6F48"));
            for (int i = 0; i < 5; i++) Arbre(g, w * 0.97f - i * w * 0.045f, horizon + h * 0.03f, h * (0.3f + (float)R.NextDouble() * 0.12f), C("#557550"));
            // pelouse
            Grad(g, new RectangleF(0, horizon, w, h - horizon), C("#7E9B63"), C("#5E7A48"), 90f);
            for (int i = 0; i < 9; i++) Poly(g, Color.FromArgb(18, 255, 255, 255), P(w * i / 9f, h), P(w * (i + 0.5f) / 9f, h), P(w / 2f + (w * (i + 0.5f) / 9f - w / 2f) * 0.15f, horizon), P(w / 2f + (w * i / 9f - w / 2f) * 0.15f, horizon));
            // allée
            Poly(g, C("#D9CDB6"), P(w * 0.42f, h), P(w * 0.58f, h), P(w * 0.515f, horizon), P(w * 0.485f, horizon));
            if (piscine) {
                Poly(g, C("#EFE7D8"), P(w * 0.6f, h * 0.7f), P(w * 0.97f, h * 0.7f), P(w * 1.02f, h * 0.93f), P(w * 0.62f, h * 0.93f));
                Poly(g, C("#4FA3C7"), P(w * 0.62f, h * 0.72f), P(w * 0.95f, h * 0.72f), P(w * 0.99f, h * 0.91f), P(w * 0.64f, h * 0.91f));
                for (int i = 0; i < 26; i++) { float rx = w * (0.66f + (float)R.NextDouble() * 0.28f), ry = h * (0.735f + (float)R.NextDouble() * 0.16f); Line(g, Color.FromArgb(70, 255, 255, 255), 2, rx, ry, rx + w * 0.025f, ry); }
            }
            // haies taillées
            Rect(g, C("#3F5C3A"), 0, h * 0.62f, w * 0.3f, h * 0.05f);
            Rect(g, C("#3F5C3A"), w * 0.7f, h * 0.62f, w * 0.3f, h * 0.05f);
            Vignette(g, w, h); Grain(g, w, h, 5000); Mention(g, w, h);
            Enregistrer(b, fichier);
        }
    }

    // Vue sur l'eau (Charente ou port), rangée de façades.
    public static void Quai(string fichier, int w, int h, int graine) {
        R = new Random(graine);
        using (var b = new Bitmap(w, h))
        using (var g = Prep(b)) {
            float berge = h * 0.58f;
            Ciel(g, w, berge, "#9DBAD6", "#F1ECE2");
            string[] teintes = { "#E7DCC8", "#DCCDB3", "#EFE6D6", "#D8C7AC", "#E3D6C0", "#F0E9DC" };
            float x = -20;
            while (x < w) {
                float lw = w * (0.1f + (float)R.NextDouble() * 0.06f);
                float lh = h * (0.2f + (float)R.NextDouble() * 0.1f);
                Color t = C(teintes[R.Next(teintes.Length)]);
                Rect(g, t, x, berge - lh, lw, lh);
                Poly(g, C("#4A5264"), P(x - 4, berge - lh), P(x + lw + 4, berge - lh), P(x + lw * 0.8f, berge - lh - h * 0.06f), P(x + lw * 0.2f, berge - lh - h * 0.06f));
                for (int i = 0; i < 3; i++) for (int n = 0; n < 3; n++)
                    Rect(g, C("#3A475C"), x + lw * (0.14f + i * 0.3f), berge - lh + lh * (0.12f + n * 0.3f), lw * 0.14f, lh * 0.18f);
                x += lw + 3;
            }
            Rect(g, C("#CFC3AE"), 0, berge, w, h * 0.04f);
            Grad(g, new RectangleF(0, berge + h * 0.04f, w, h - berge), C("#6F8FA8"), C("#3F5B73"), 90f);
            for (int i = 0; i < 120; i++) {
                float yy = berge + h * 0.05f + (float)R.NextDouble() * (h - berge);
                float xx = (float)R.NextDouble() * w;
                Line(g, Color.FromArgb(R.Next(30, 80), 255, 255, 255), 2, xx, yy, xx + R.Next(20, 90), yy);
            }
            // un voilier
            Poly(g, C("#F4F1EA"), P(w * 0.7f, h * 0.83f), P(w * 0.78f, h * 0.83f), P(w * 0.765f, h * 0.87f), P(w * 0.715f, h * 0.87f));
            Line(g, C("#3A3A3A"), 3, w * 0.74f, h * 0.83f, w * 0.74f, h * 0.64f);
            Poly(g, C("#FAF8F2"), P(w * 0.742f, h * 0.65f), P(w * 0.742f, h * 0.82f), P(w * 0.79f, h * 0.82f));
            Vignette(g, w, h); Grain(g, w, h, 5000); Mention(g, w, h);
            Enregistrer(b, fichier);
        }
    }

    // Château : corps central et deux tours.
    public static void Chateau(string fichier, int w, int h, int graine) {
        R = new Random(graine);
        using (var b = new Bitmap(w, h))
        using (var g = Prep(b)) {
            float sol = h * 0.8f;
            Ciel(g, w, sol, "#84A9D1", "#EEF1EE");
            for (int i = 0; i < 5; i++) Arbre(g, w * (0.02f + i * 0.05f), sol, h * 0.55f, C("#50704A"));
            for (int i = 0; i < 5; i++) Arbre(g, w * (0.98f - i * 0.05f), sol, h * 0.55f, C("#557550"));
            Color pierre = C("#E6DCCB");
            float cx = w * 0.3f, cw = w * 0.4f, ch = h * 0.32f;
            Rect(g, pierre, cx, sol - ch, cw, ch);
            Poly(g, C("#4A5264"), P(cx - 8, sol - ch), P(cx + cw + 8, sol - ch), P(cx + cw * 0.9f, sol - ch - h * 0.12f), P(cx + cw * 0.1f, sol - ch - h * 0.12f));
            foreach (float tx in new float[] { cx - w * 0.07f, cx + cw - w * 0.02f }) {
                float tw = w * 0.09f, th = h * 0.44f;
                Rect(g, Mix(pierre, Color.Black, 0.04), tx, sol - th, tw, th);
                Poly(g, C("#434B5C"), P(tx - 10, sol - th), P(tx + tw + 10, sol - th), P(tx + tw / 2, sol - th - h * 0.2f));
                for (int n = 0; n < 3; n++) Fenetre(g, tx + tw * 0.32f, sol - th + th * (0.12f + n * 0.3f), tw * 0.36f, th * 0.16f, pierre, false, Color.Gray, false);
            }
            for (int n = 0; n < 2; n++) for (int i = 0; i < 5; i++)
                Fenetre(g, cx + cw * (i + 0.34f) / 5, sol - ch + ch * (0.12f + n * 0.47f), cw / 5 * 0.32f, ch * 0.32f, pierre, false, Color.Gray, R.Next(3) == 0);
            Grad(g, new RectangleF(0, sol, w, h - sol), C("#7C9A62"), C("#5C7847"), 90f);
            Poly(g, C("#D9CDB6"), P(w * 0.44f, h), P(w * 0.56f, h), P(w * 0.51f, sol), P(w * 0.49f, sol));
            Vignette(g, w, h); Grain(g, w, h, 5000); Mention(g, w, h);
            Enregistrer(b, fichier);
        }
    }

    static void Enregistrer(Bitmap b, string fichier) {
        ImageCodecInfo jpeg = null;
        foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") jpeg = c;
        var p = new EncoderParameters(1);
        p.Param[0] = new EncoderParameter(Encoder.Quality, 86L);
        b.Save(fichier, jpeg, p);
    }

    // Réduction en miniature (800 px de large).
    public static void Miniature(string source, string cible, int largeur) {
        using (var src = new Bitmap(source)) {
            int hauteur = (int)Math.Round(src.Height * (double)largeur / src.Width);
            using (var b = new Bitmap(largeur, hauteur))
            using (var g = Prep(b)) {
                g.DrawImage(src, 0, 0, largeur, hauteur);
                ImageCodecInfo jpeg = null;
                foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") jpeg = c;
                var p = new EncoderParameters(1);
                p.Param[0] = new EncoderParameter(Encoder.Quality, 80L);
                b.Save(cible, jpeg, p);
            }
        }
    }

    // ---------- Images provisoires de la charte (remplacées par les vraies) ----------
    public static void LogoProvisoire(string fichier, string couleurHex) {
        using (var b = new Bitmap(900, 909))
        using (var g = Prep(b)) {
            g.Clear(Color.Transparent);
            Color c = C(couleurHex);
            using (var f = new Font("Georgia", 190, FontStyle.Regular, GraphicsUnit.Pixel))
            using (var br = new SolidBrush(c)) {
                var fmt = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString("PETRA", f, br, 450, 250, fmt);
                g.DrawString("GEST", f, br, 450, 470, fmt);
            }
            Line(g, c, 6, 250, 470, 650, 470);
            b.Save(fichier, ImageFormat.Png);
        }
    }
    public static void EmblemeProvisoire(string fichier) {
        using (var b = new Bitmap(256, 256))
        using (var g = Prep(b)) {
            g.Clear(C("#001B5C"));
            using (var f = new Font("Georgia", 120, FontStyle.Regular, GraphicsUnit.Pixel))
            using (var br = new SolidBrush(C("#E6CDB7"))) {
                var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString("PG", f, br, new RectangleF(0, 0, 256, 256), fmt);
            }
            b.Save(fichier, ImageFormat.Png);
        }
    }
    public static void PortraitProvisoire(string fichier, string initiales) {
        using (var b = new Bitmap(600, 600))
        using (var g = Prep(b)) {
            Grad(g, new RectangleF(0, 0, 600, 600), C("#F3E6D8"), C("#E6CDB7"), 90f);
            using (var f = new Font("Georgia", 190, FontStyle.Regular, GraphicsUnit.Pixel))
            using (var br = new SolidBrush(C("#001B5C"))) {
                var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString(initiales, f, br, new RectangleF(0, 0, 600, 600), fmt);
            }
            Enregistrer(b, fichier);
        }
    }
}
'@

function Photo([string]$nom, [scriptblock]$dessin) {
    $g = Join-Path $sortiePhotos "$nom-g.jpg"
    & $dessin $g
    [Visuels]::Miniature($g, (Join-Path $sortiePhotos "$nom-m.jpg"), 800)
    Write-Host "  $nom"
}

$W = 1600; $H = 1067
Write-Host 'Visuels de démonstration :'
# 1. Hôtel particulier (Rochefort)
Photo 'hotel-facade'   { param($f) [Visuels]::Facade($f, $W, $H, 3, 5, '#E9DFCD', $true, $false, '#6E7F95', $true, '#7FA6D0', '#F3EEE4', 11) }
Photo 'hotel-salon'    { param($f) [Visuels]::Interieur($f, $W, $H, '#E8E1D5', $true, $true, '#9A6E48', 12) }
Photo 'hotel-jardin'   { param($f) [Visuels]::Jardin($f, $W, $H, $false, '#E9DFCD', 13) }
Photo 'hotel-chambre'  { param($f) [Visuels]::Interieur($f, $W, $H, '#D9DEE4', $false, $false, '#8E6746', 14) }
# 2. Appartement, résidence classée, vue sur la Charente (Rochefort)
Photo 'arsenal-facade' { param($f) [Visuels]::Facade($f, $W, $H, 3, 9, '#E6DCC9', $true, $false, '#6E7F95', $false, '#86ABD2', '#F1ECE3', 21) }
Photo 'arsenal-sejour' { param($f) [Visuels]::Interieur($f, $W, $H, '#EFEBE3', $false, $false, '#A57A52', 22) }
Photo 'arsenal-vue'    { param($f) [Visuels]::Quai($f, $W, $H, 23) }
# 3. Demeure et dépendances (Surgères)
Photo 'demeure-facade' { param($f) [Visuels]::Facade($f, $W, $H, 2, 7, '#E2D5BE', $false, $true, '#8C9AA6', $false, '#7DA3CC', '#F4EFE6', 31) }
Photo 'demeure-parc'   { param($f) [Visuels]::Jardin($f, $W, $H, $true, '#E2D5BE', 32) }
Photo 'demeure-salon'  { param($f) [Visuels]::Interieur($f, $W, $H, '#E4DCCB', $true, $false, '#7F5A3C', 33) }
# 4. Maison de ville (La Rochelle)
Photo 'rochelle-facade' { param($f) [Visuels]::Facade($f, $W, $H, 3, 3, '#EEE7DA', $false, $true, '#5F7C93', $false, '#8AB0D6', '#F2EEE6', 41) }
Photo 'rochelle-patio'  { param($f) [Visuels]::Jardin($f, $W, $H, $false, '#EEE7DA', 42) }
Photo 'rochelle-sejour' { param($f) [Visuels]::Interieur($f, $W, $H, '#F1EEE8', $false, $true, '#B58B61', 43) }
# 5. Logis à restaurer (Tonnay-Charente)
Photo 'logis-facade'  { param($f) [Visuels]::Facade($f, $W, $H, 2, 4, '#D6C6A8', $false, $true, '#9AA3A0', $false, '#94B4D3', '#F0EBDF', 51) }
Photo 'logis-terrain' { param($f) [Visuels]::Jardin($f, $W, $H, $false, '#D6C6A8', 52) }
# 6. Appartement bourgeois (vendu)
Photo 'bourgeois-salon'  { param($f) [Visuels]::Interieur($f, $W, $H, '#E6E2DA', $true, $true, '#8A6243', 61) }
Photo 'bourgeois-facade' { param($f) [Visuels]::Facade($f, $W, $H, 4, 5, '#EAE2D3', $true, $false, '#6E7F95', $false, '#83A8CF', '#F2EDE4', 62) }
# 7. Château (brouillon)
Photo 'chateau-facade' { param($f) [Visuels]::Chateau($f, $W, $H, 71) }

Write-Host 'Images de charte provisoires (seulement si absentes) :'
$provisoires = @{
    'pg-logo-sable.png'      = { param($f) [Visuels]::LogoProvisoire($f, '#E6CDB7') }
    'pg-logo-navy.png'       = { param($f) [Visuels]::LogoProvisoire($f, '#001B5C') }
    'pg-embleme-navy.png'    = { param($f) [Visuels]::EmblemeProvisoire($f) }
    'personne-catherine.jpg' = { param($f) [Visuels]::PortraitProvisoire($f, 'CB') }
}
foreach ($nom in $provisoires.Keys) {
    $cible = Join-Path $sortieAssets $nom
    if (Test-Path $cible) { Write-Host "  $nom : déjà présent, conservé"; continue }
    & $provisoires[$nom] $cible
    Write-Host "  $nom : provisoire créé"
}
