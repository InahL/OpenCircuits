import {V} from "Vector";

import {Setup} from "test/helpers/Setup";

import {ConstantLow} from "digital/models/ioobjects";


describe("FitToScreenHandler", () => {
    const {input, designer, selections, camera} = Setup();
    const {Place} = GetHelpers(designer);

    afterEach(() => {
        designer.reset();
        selections.get().forEach(s => selections.deselect(s));
    });

    test("Fit to Screen of a Single Object", () => {
        const [lo] = Place(new ConstantLow());

        expect(designer.getObjects()).toHaveLength(1)
        expect(selections.amount()).toBe(0);

        input.click(V(0, 0));

        expect(selections.amount()).toBe(1);

        input.pressKey("f")
            .releaseKey("f");

        expect(selections.amount()).toBe(1);
        expect(camera.getPos()).toEqual(V(21.5,0));

    });

    test("Fit to Screen with no objects", () => {

        expect(designer.getObjects()).toHaveLength(0)
        expect(selections.amount()).toBe(0);

        input.pressKey("f")
            .releaseKey("f");

        expect(selections.amount()).toBe(0);
        expect(camera.getPos()).toEqual(V(0,0));

    });
});
