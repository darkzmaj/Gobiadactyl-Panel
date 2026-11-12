import { skin, type ThemeSkins } from '@pterodactyl/sdk/theme';

/** The Gobia shell draws its own footer, so the copyright line under every page is dropped. */
function NoPageFooter() {
    return null;
}

/**
 * Classic's recipes read the panel tokens (theme.css sets Gobia's colours, radius and fonts), and the Gobia surfaces
 * are the gb-* classes of gobia.css; these skins only undo what the tokens cannot reach. Gobia writes labels, buttons
 * and card titles in sentence case with medium corners, where classic uppercases them.
 */
export const skins: ThemeSkins = {
    Button: skin('Button', {
        root: (state, below) => below('normal-case tracking-normal rounded-md font-semibold'),
    }),
    Label: skin('Label', {
        root: (state, below) => below('normal-case'),
    }),
    Card: skin('Card', {
        root: (state, below) => below('rounded-lg'),
        title: (state, below) => below('normal-case tracking-normal text-base'),
    }),
    PageFooter: NoPageFooter,
};
