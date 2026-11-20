sap.ui.define([
    "./BaseController", "sap/m/Dialog", "sap/m/Button", "sap/m/Link",
    "sap/ui/core/HTML", "sap/ui/core/Item", "sap/ui/Device"
], function (Base, Dialog, Button, Link, HTML, Item, Device) {
    "use strict";

    return Base.extend("sapselfservice.controller.DocumentController", {
        loadDocuments(route, kind, modelName, property) {
            this.documentModel = modelName;
            this.filteredProperty = property;
            this.isPay = kind === "pay";
            this.observe(route, async function () {
                this.documents = await this.hr().documents(this.id(), kind);
                if (!this.isPay) {
                    const select = this.byId("yearSelect");
                    select.destroyItems();
                    select.addItem(new Item({ key: "", text: "Alle Jahre" }));
                    [...new Set(this.documents.map((row) => row.year))].forEach((year) =>
                        select.addItem(new Item({ key: String(year), text: String(year) })));
                }
                this.onResetFilter();
            });
        },

        onFilterChange(event) {
            const month = this.isPay && this.byId("monthSelect").getSelectedKey();
            const year = this.isPay ? String(event?.getParameter("value") ?? this.byId("yearInput").getValue()).trim() :
                this.byId("yearSelect").getSelectedKey();
            this.model(this.documentModel).setProperty("/" + this.filteredProperty,
                this.documents.filter((row) => (!year || year === String(row.year)) && (!month || month === String(row.month))));
        },

        onResetFilter() {
            if (this.isPay) {
                this.byId("monthSelect").setSelectedKey("");
                this.byId("yearInput").setValue("");
            } else {
                this.byId("yearSelect").setSelectedKey("");
            }
            this.model(this.documentModel, { [this.filteredProperty]: this.documents });
        },

        openDocument(event) {
            const row = event.getSource().getBindingContext(this.documentModel).getObject();
            const title = row.name + " · " + row.date;
            const source = sap.ui.require.toUrl("sapselfservice/" + row.filePath);
            const inline = Device.system.desktop && navigator.pdfViewerEnabled;
            const controls = [new Link({
                text: "PDF im Browser öffnen", href: source, target: "_blank"
            }).addStyleClass("sapUiSmallMargin")];
            if (inline) {
                const preview = new HTML({ content: '<div class="portalPdfPreview"></div>' });
                preview.attachAfterRendering(() => {
                    const container = preview.getDomRef();
                    if (!container || container.firstChild) return;
                    const frame = document.createElement("iframe");
                    frame.title = title;
                    frame.src = source;
                    container.append(frame);
                });
                controls.push(preview);
            }
            const dialog = new Dialog({
                title, contentWidth: inline ? "64rem" : "28rem", content: controls,
                endButton: new Button({ text: "Schließen", press: () => dialog.close() }),
                afterClose: () => dialog.destroy()
            });
            this.getView().addDependent(dialog);
            dialog.open();
        }
    });
});
