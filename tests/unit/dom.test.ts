import { describe, expect, test } from "@jest/globals";
import * as DOM from "../../src/dom";

describe("DOM", () => {
  test(".getNodeSelector()", () => {
    // Markup from Bootstrap 5 example code, with added data-test-id attributes and random unique
    // identifier suffixes.
    document.body.innerHTML = `
      <a data-test-id="skip-link" class="visually-hidden-focusable" href="#content">Skip to main content</a>
      <div class="body-wrapper-y4195VjkmAgT5ZVvGD0Q">
        <nav class="navbar navbar-expand-lg navbar-F28dkzzayHXMiWXrgkgo">
          <div class="container-fluid container-iyJMaFU1s6Bs_7VrafMU">
            <a data-test-id="nav-brand-link" class="navbar-brand" href="#">Navbar</a>
            <button data-test-id="nav-toggle-button" class="button-O5KUpdgHsFEASScv6nP2 navbar-toggler toggle-lHJRv8vY7s4S791EeQ3p" type="button">
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarSupportedContent">
              <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                <li class="nav-item">
                  <a data-test-id="nav-item" class="nav-link active" aria-current="page" href="#">Home</a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#">Link</a>
                </li>
                <li class="nav-item dropdown">
                  <a data-test-id="nav-dropdown" class="nav-link dropdown-toggle" href="#" role="button">
                    Dropdown
                  </a>
                  <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="#">Action</a></li>
                    <li><a data-test-id="nav-dropdown-item" class="dropdown-item" href="#">Another action</a></li>
                  </ul>
                </li>
              </ul>
              <form class="d-flex" role="search">
                <input data-test-id="nav-search-input" id="search-input" class="form-control me-2" type="search" placeholder="Search">
                <button data-test-id="nav-search-button" class="button-O5KUpdgHsFEASScv6nP2 btn btn-outline-success" type="submit">Search</button>
              </form>
            </div>
          </div>
        </nav>

        <div class="container">
          <div class="card" style="width: 18rem;">
            <img data-test-id="card-image" src="#" class="card-img-top image-hBOtxGpgNcjdCFmTmqeS" alt="...">
            <div class="card-body">
              <h5 class="card-title">Card title</h5>
              <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
              <a data-test-id="card-button" href="#" class="btn btn-primary button-WDj01iHIXvMk8o2JqJ6U button--active-yh5sBeahQ855CObtU1Lj">Go somewhere</a>
            </div>
          </div>

          <a href="#" data-test-id="many-classnames" class="button__link-o7s0BBmcy1Mf3HQWTasA button--secondary-cYMyXEz7z2vOr8VwCbDg button-W3DA1Oo7vxGcpJ6GA5jg button--link-style-z69Aa_cbSolYBn8xepzH home__action-button-xwXUDBUof8sT7vrBrAwa">
            Anchor with many classes
          </a>

          <a href="#" data-test-id="long-classname" class="button__link-o7s0BBmcy1Mf3HQWTasA_-_button--secondary-cYMyXEz7z2vOr8VwCbDg_-_button-W3DA1Oo7vxGcpJ6GA5jg_-_button--link-style-z69Aa_cbSolYBn8xepzH_-_home__action-button-xwXUDBUof8sT7vrBrAwa">
            Anchor with a long classname
          </a>
        </div>
      </div>
    `;

    const skipLink = document.querySelector("[data-test-id=skip-link]")!;
    const skipLinkSelector = DOM.getNodeSelector(skipLink);
    expect(skipLinkSelector.length).toBeLessThan(101);
    expect(skipLinkSelector).toEqual("html>body>a.visually-hidden-focusable");

    const navBrandLink = document.querySelector("[data-test-id=nav-brand-link]")!;
    const navBrandLinkSelector = DOM.getNodeSelector(navBrandLink);
    expect(navBrandLinkSelector.length).toBeLessThan(101);
    expect(navBrandLinkSelector).toEqual(
      "div.container-fluid.container-iyJMaFU1s6Bs_7VrafMU>a.navbar-brand",
    );

    const navToggleButton = document.querySelector("[data-test-id=nav-toggle-button]")!;
    const navToggleButtonSelector = DOM.getNodeSelector(navToggleButton);
    expect(navToggleButtonSelector.length).toBeLessThan(101);
    expect(navToggleButtonSelector).toEqual(
      "button.button-O5KUpdgHsFEASScv6nP2.navbar-toggler.toggle-lHJRv8vY7s4S791EeQ3p",
    );

    const navItem = document.querySelector("[data-test-id=nav-item]")!;
    const navItemSelector = DOM.getNodeSelector(navItem);
    expect(navItemSelector.length).toBeLessThan(101);
    expect(navItemSelector).toEqual(
      "#navbarSupportedContent>ul.navbar-nav.me-auto.mb-2.mb-lg-0>li.nav-item>a.nav-link.active",
    );

    const navDropdown = document.querySelector("[data-test-id=nav-dropdown]")!;
    const navDropdownSelector = DOM.getNodeSelector(navDropdown);
    expect(navDropdownSelector.length).toBeLessThan(101);
    expect(navDropdownSelector).toEqual(
      "ul.navbar-nav.me-auto.mb-2.mb-lg-0>li.nav-item.dropdown>a.nav-link.dropdown-toggle",
    );

    const navDropdownItem = document.querySelector("[data-test-id=nav-dropdown-item]")!;
    const navDropdownItemSelector = DOM.getNodeSelector(navDropdownItem);
    expect(navDropdownItemSelector.length).toBeLessThan(101);
    expect(navDropdownItemSelector).toEqual(
      "ul.navbar-nav.me-auto.mb-2.mb-lg-0>li.nav-item.dropdown>ul.dropdown-menu>li>a.dropdown-item",
    );

    const navSearchInput = document.querySelector("[data-test-id=nav-search-input]")!;
    const navSearchInputSelector = DOM.getNodeSelector(navSearchInput);
    expect(navSearchInputSelector.length).toBeLessThan(101);
    expect(navSearchInputSelector).toEqual("#search-input");

    const navSearchButton = document.querySelector("[data-test-id=nav-search-button]")!;
    const navSearchButtonSelector = DOM.getNodeSelector(navSearchButton);
    expect(navSearchButtonSelector.length).toBeLessThan(101);
    expect(navSearchButtonSelector).toEqual(
      "#navbarSupportedContent>form.d-flex>button.button-O5KUpdgHsFEASScv6nP2.btn.btn-outline-success",
    );

    const cardImage = document.querySelector("[data-test-id=card-image]")!;
    const cardImageSelector = DOM.getNodeSelector(cardImage);
    expect(cardImageSelector.length).toBeLessThan(101);
    expect(cardImageSelector).toEqual(
      "div.container>div.card>img.card-img-top.image-hBOtxGpgNcjdCFmTmqeS",
    );

    const cardButton = document.querySelector("[data-test-id=card-button]")!;
    const cardButtonSelector = DOM.getNodeSelector(cardButton);
    expect(cardButtonSelector.length).toBeLessThan(101);
    expect(cardButtonSelector).toEqual(
      "div.card-body>a.btn.btn-primary.button-WDj01iHIXvMk8o2JqJ6U.button--active-yh5sBeahQ855CObtU1Lj",
    );

    const manyClassNames = document.querySelector("[data-test-id=many-classnames]")!;
    const manyClassNamesSelector = DOM.getNodeSelector(manyClassNames);
    expect(manyClassNamesSelector.length).toBeLessThan(101);
    expect(manyClassNamesSelector).toEqual(
      "div.container>a.button__link-o7s0BBmcy1Mf3HQWTasA.button--secondary-cYMyXEz7z2vOr8VwCbDg",
    );

    const longClassName = document.querySelector("[data-test-id=long-classname]")!;
    const longClassNameSelector = DOM.getNodeSelector(longClassName);
    expect(longClassNameSelector.length).toBeLessThan(101);
    expect(longClassNameSelector).toEqual(
      "html>body>div.body-wrapper-y4195VjkmAgT5ZVvGD0Q>div.container>a",
    );
  });

  test(".getNodeSelector() when the node is removed", () => {
    document.body.innerHTML = `
      <div class="body-wrapper-y4195VjkmAgT5ZVvGD0Q">
        <div class="container">
          <button class="btn btn-primary">Click me</button>
        </div>
      </div>
    `;

    const button = document.querySelector("button")!;
    button.remove();
    const buttonSelector = DOM.getNodeSelector(button);
    expect(buttonSelector).toEqual("button.btn.btn-primary");
  });
});
