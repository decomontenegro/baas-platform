# Acessibilidade - BaaS Dashboard

Este documento descreve as práticas de acessibilidade implementadas no BaaS Dashboard, seguindo as diretrizes WCAG 2.1 AA.

## Índice

- [Visão Geral](#visão-geral)
- [Componentes](#componentes)
- [Hooks de Acessibilidade](#hooks-de-acessibilidade)
- [Padrões de Teclado](#padrões-de-teclado)
- [Checklist de Desenvolvimento](#checklist-de-desenvolvimento)
- [Testes](#testes)

## Visão Geral

### Princípios WCAG

1. **Perceptível** - Informação apresentável de formas que usuários possam perceber
2. **Operável** - Interface navegável e operável
3. **Compreensível** - Informação e operação compreensíveis
4. **Robusto** - Conteúdo interpretável por tecnologias assistivas

### Conformidade

O dashboard segue WCAG 2.1 nível AA, incluindo:
- Contraste de cores mínimo 4.5:1 para texto normal
- Contraste mínimo 3:1 para texto grande e elementos de interface
- Navegação completa por teclado
- Suporte a leitores de tela

## Componentes

### Button (`src/components/ui/button.tsx`)

```tsx
// ✅ Botão com ícone - sempre use aria-label
<Button size="icon" aria-label="Excluir item">
  <Trash className="h-4 w-4" />
</Button>

// ✅ Ou use o componente IconButton
<IconButton label="Excluir item" icon={<Trash />} variant="destructive" />

// ✅ Estado de carregamento
<Button loading>Salvando...</Button>
```

**Propriedades de acessibilidade:**
- `aria-label` - Obrigatório para botões apenas com ícone
- `aria-disabled` - Aplicado automaticamente quando `disabled`
- `aria-busy` - Aplicado quando `loading=true`
- Focus ring visível com `focus-visible`

### Input (`src/components/ui/input.tsx`)

```tsx
// ✅ Com label visível
<Input label="Email" type="email" required />

// ✅ Com mensagem de erro
<Input 
  label="Senha" 
  type="password" 
  error="A senha deve ter pelo menos 8 caracteres" 
/>

// ✅ Com dica
<Input 
  label="Nome de usuário" 
  hint="Apenas letras, números e underscores" 
/>

// ✅ Label oculta (para buscas, etc.)
<Input 
  label="Buscar" 
  labelPosition="hidden" 
  placeholder="Buscar..." 
/>
```

**Propriedades de acessibilidade:**
- `htmlFor/id` - Associação automática entre label e input
- `aria-describedby` - Conecta dicas e mensagens de erro
- `aria-invalid` - Aplicado quando há erro
- `aria-required` - Indica campos obrigatórios

### Sidebar (`src/components/dashboard/sidebar.tsx`)

**Implementações:**
- `role="navigation"` no elemento nav
- `aria-label="Navegação principal"` para contexto
- `aria-current="page"` no item ativo
- Navegação por setas (↑/↓) entre itens
- Teclas Home/End para primeiro/último item
- `aria-expanded` no botão de recolher

### Header (`src/components/dashboard/header.tsx`)

**Implementações:**
- `role="banner"` no header
- `role="search"` na área de busca
- Breadcrumbs com `aria-current="page"`
- Notificações com `aria-live="polite"` para atualizações
- Botões com labels descritivos

### Modal/Dialog (`src/components/ui/modal.tsx`, `dialog.tsx`)

```tsx
// ✅ Modal acessível
<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Confirmar exclusão"
  description="Esta ação não pode ser desfeita."
>
  <div className="flex gap-2">
    <Button onClick={() => setIsOpen(false)}>Cancelar</Button>
    <Button variant="destructive">Excluir</Button>
  </div>
</Modal>

// ✅ Dialog de confirmação
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Excluir item?"
  description="Esta ação é permanente."
  confirmLabel="Excluir"
  onConfirm={handleDelete}
  variant="destructive"
/>
```

**Propriedades de acessibilidade:**
- `aria-modal="true"` - Indica modal ativo
- `aria-labelledby` - Conecta ao título
- `aria-describedby` - Conecta à descrição
- Focus trap - Foco fica preso no modal
- ESC para fechar
- Retorno de foco ao elemento que abriu

## Hooks de Acessibilidade

### useFocusTrap (`src/lib/a11y/use-focus-trap.ts`)

Mantém o foco dentro de um container.

```tsx
function Modal({ isOpen, onClose }) {
  const containerRef = useFocusTrap<HTMLDivElement>({
    enabled: isOpen,
    returnFocusTo: triggerButtonRef.current,
  });
  
  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {/* conteúdo */}
    </div>
  );
}
```

**Opções:**
- `enabled` - Ativar/desativar trap
- `returnFocusTo` - Elemento para retornar foco
- `initialFocus` - Elemento inicial a focar
- `allowOutsideClick` - Permitir cliques fora

### useKeyboardNav (`src/lib/a11y/use-keyboard-nav.ts`)

Navegação por teclado em listas.

```tsx
function Menu({ items }) {
  const { containerProps, getItemProps, activeIndex } = useKeyboardNav({
    direction: "vertical",
    wrap: "wrap",
    homeEnd: true,
    typeAhead: true,
  });
  
  return (
    <ul {...containerProps}>
      {items.map((item, index) => (
        <li key={item.id} {...getItemProps(index)}>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

**Opções:**
- `direction` - "vertical", "horizontal", ou "both"
- `wrap` - "wrap", "stop", ou "none"
- `homeEnd` - Habilitar Home/End
- `typeAhead` - Busca por digitação

### useRovingTabIndex

Padrão roving tabindex para grupos.

```tsx
const { focusedIndex, handleKeyDown, getTabIndex } = useRovingTabIndex(
  items.length,
  { vertical: true, loop: true }
);

{items.map((item, index) => (
  <button
    key={item.id}
    tabIndex={getTabIndex(index)}
    onKeyDown={(e) => handleKeyDown(e, index)}
  >
    {item.label}
  </button>
))}
```

### Utilitários (`src/lib/a11y/index.ts`)

```tsx
// Anunciar para leitores de tela
announce("Item salvo com sucesso", "polite")
announce("Erro ao salvar!", "assertive")

// Verificar preferências do usuário
if (prefersReducedMotion()) {
  // Desabilitar animações
}

if (prefersHighContrast()) {
  // Usar estilos de alto contraste
}

// Obter elementos focáveis
const focusableElements = getFocusableElements(containerRef.current)
```

## Padrões de Teclado

### Navegação Global

| Tecla | Ação |
|-------|------|
| Tab | Próximo elemento focável |
| Shift + Tab | Elemento focável anterior |
| Enter/Space | Ativar elemento |
| Escape | Fechar modal/menu |

### Navegação em Menus

| Tecla | Ação |
|-------|------|
| ↑ / ↓ | Navegar entre itens |
| Home | Primeiro item |
| End | Último item |
| Enter | Selecionar item |
| Letra | Ir para item que começa com a letra |

### Navegação em Modais

| Tecla | Ação |
|-------|------|
| Tab | Próximo elemento no modal |
| Shift + Tab | Elemento anterior no modal |
| Escape | Fechar modal |

## Checklist de Desenvolvimento

### Antes de cada PR

- [ ] Todos os elementos interativos são focáveis via Tab
- [ ] Focus rings são visíveis (não remover `outline`)
- [ ] Imagens têm `alt` text (ou `aria-hidden` se decorativas)
- [ ] Ícones-only têm `aria-label`
- [ ] Formulários têm labels associados
- [ ] Erros são anunciados (`role="alert"` ou `aria-live`)
- [ ] Cores têm contraste suficiente (4.5:1 texto, 3:1 UI)
- [ ] Modais têm focus trap e fecham com ESC
- [ ] Navegação funciona apenas com teclado
- [ ] `aria-current="page"` no item de navegação ativo

### Testes Manuais

1. **Navegação por teclado:**
   - Navegar toda a interface apenas com Tab
   - Verificar que focus ring é sempre visível
   - Testar atalhos de teclado documentados

2. **Leitor de tela:**
   - Testar com VoiceOver (macOS) ou NVDA (Windows)
   - Verificar que conteúdo é anunciado corretamente
   - Confirmar que atualizações dinâmicas são anunciadas

3. **Contraste:**
   - Usar ferramenta de contraste (ex: Chrome DevTools)
   - Verificar em modo claro e escuro

### ESLint

O projeto usa `eslint-plugin-jsx-a11y` para catch erros comuns:

```bash
npm run lint
```

Regras habilitadas:
- `alt-text` - Imagens precisam de alt
- `anchor-has-content` - Links precisam de conteúdo
- `aria-props` - Propriedades ARIA válidas
- `aria-role` - Roles ARIA válidos
- `click-events-have-key-events` - Eventos de clique precisam de teclado
- `heading-has-content` - Headings precisam de conteúdo
- `html-has-lang` - HTML precisa de lang
- `interactive-supports-focus` - Elementos interativos precisam ser focáveis
- `label-has-associated-control` - Labels associados
- `no-autofocus` - Evitar autofocus (exceto em modais)
- `no-noninteractive-element-interactions` - Não usar eventos em não-interativos
- `role-has-required-aria-props` - Props ARIA obrigatórios
- `tabindex-no-positive` - Não usar tabindex > 0

## Testes

### Ferramentas Recomendadas

1. **axe DevTools** - Extensão para Chrome/Firefox
2. **Lighthouse** - Auditoria de acessibilidade
3. **WAVE** - Ferramenta de avaliação
4. **Screen readers:**
   - VoiceOver (macOS, built-in)
   - NVDA (Windows, gratuito)
   - JAWS (Windows, pago)

### Testes Automatizados

```tsx
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

test('should have no accessibility violations', async () => {
  const { container } = render(<MyComponent />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Recursos

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)

---

Última atualização: $(date +%Y-%m-%d)
